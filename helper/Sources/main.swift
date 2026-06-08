@preconcurrency import EventKit
import Foundation

// MARK: - Models (match SPEC §5.1 / §5.2)

struct CalendianEvent: Codable {
    var id: String
    var source: String = "macos-calendar"
    var calendarId: String
    var calendarName: String
    var calendarColor: String
    var accountName: String
    var title: String
    var start: String  // ISO 8601
    var end: String?   // ISO 8601
    var isAllDay: Bool
    var isRecurring: Bool
    var recurrenceSummary: String
    var location: String
    var url: String
    var notes: String
    var attendees: [String]
}

struct CalendianReminder: Codable {
    var id: String
    var source: String = "macos-reminders"
    var listId: String
    var listName: String
    var title: String
    var dueDate: String?   // ISO 8601 date
    var dueTime: String?   // HH:mm
    var priority: String   // "none" | "low" | "medium" | "high"
    var completed: Bool
    var parentId: String?
    var notes: String
}

struct CalendarSourceInfo: Codable {
    var id: String
    var name: String
    var color: String       // "r,g,b" format
    var accountName: String // e.g. "iCloud", "Outlook"
    var type: String        // "event" | "reminder"
}

struct PermissionStatus: Codable {
    var events: String      // "granted" | "denied" | "notDetermined"
    var reminders: String
}

struct WriteResult: Codable {
    var ok: Bool
    var id: String
    var completed: Bool?  // only for toggle-reminder
}

// MARK: - Main

@main
struct CalendianHelper {
    static let store = EKEventStore()
    static let encoder: JSONEncoder = {
        let e = JSONEncoder()
        e.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
        return e
    }()

    static func main() async {
        let args = CommandLine.arguments
        guard args.count >= 2 else {
            printUsage()
            exit(1)
        }

        let command = args[1]
        do {
            switch command {
            case "calendars":
                try await printCalendars()
            case "lists":
                try await printReminderLists()
            case "events":
                guard args.count >= 4 else { printUsage(); exit(1) }
                let from = args[2]
                let to = args[3]
                let ids = args.count > 4 ? Array(args[4...]) : []
                try await printEvents(from: from, to: to, calendarIDs: ids)
            case "reminders":
                guard args.count >= 4 else { printUsage(); exit(1) }
                let from = args[2]
                let to = args[3]
                let ids = args.count > 4 ? Array(args[4...]) : []
                try await printReminders(from: from, to: to, listIDs: ids)
            case "permissions":
                printPermissions()
            case "request-events":
                try await requestEventsAccess()
            case "request-reminders":
                try await requestRemindersAccess()
            case "reminders-nodate":
                let nodateIDs = args.count > 2 ? Array(args[2...]) : []
                try await printNoDateReminders(listIDs: nodateIDs)
            case "toggle-reminder":
                guard args.count >= 3 else { printUsage(); exit(1) }
                try toggleReminder(args[2])
            case "create-event":
                guard args.count >= 7 else { printUsage(); exit(1) }
                let isAllDay = args[6] == "true"
                let location = args.count > 7 ? args[7] : ""
                let notes = args.count > 8 ? args[8] : ""
                let url = args.count > 9 ? args[9] : ""
                try await createEvent(title: args[2], startISO: args[3], endISO: args[4],
                                      calendarID: args[5], isAllDay: isAllDay,
                                      location: location, notes: notes, url: url)
            case "create-reminder":
                guard args.count >= 4 else { printUsage(); exit(1) }
                let dueDate = args.count > 4 ? args[4] : ""
                let dueTime = args.count > 5 ? args[5] : ""
                let priority = args.count > 6 ? args[6] : "none"
                let notes = args.count > 7 ? args[7] : ""
                try await createReminder(title: args[2], listID: args[3],
                                         dueDate: dueDate, dueTime: dueTime,
                                         priority: priority, notes: notes)
            case "watch":
                let signalFile = args.count > 2 ? args[2] : "/tmp/calendian-watch-signal"
                try await watchChanges(signalFile: signalFile)
            // v0.4: edit/delete commands (REQ-WRITE-011 to REQ-WRITE-020)
            case "edit-event":
                guard args.count >= 8 else { printUsage(); exit(1) }
                let editLocation = args.count > 8 ? args[8] : ""
                let editNotes = args.count > 9 ? args[9] : ""
                let editUrl = args.count > 10 ? args[10] : ""
                try await editEvent(eventID: args[2], title: args[3], startISO: args[4],
                                    endISO: args[5], calendarID: args[6],
                                    isAllDay: args[7] == "true",
                                    location: editLocation, notes: editNotes, url: editUrl)
            case "delete-event":
                guard args.count >= 3 else { printUsage(); exit(1) }
                try await deleteEvent(eventID: args[2])
            case "edit-reminder":
                guard args.count >= 5 else { printUsage(); exit(1) }
                let editDueDate = args.count > 5 ? args[5] : ""
                let editDueTime = args.count > 6 ? args[6] : ""
                let editPriority = args.count > 7 ? args[7] : "none"
                let editRemNotes = args.count > 8 ? args[8] : ""
                try await editReminder(reminderID: args[2], title: args[3], listID: args[4],
                                       dueDate: editDueDate, dueTime: editDueTime,
                                       priority: editPriority, notes: editRemNotes)
            case "delete-reminder":
                guard args.count >= 3 else { printUsage(); exit(1) }
                try await deleteReminder(reminderID: args[2])
            default:
                printUsage()
                exit(1)
            }
        } catch {
            fputs("{\"error\":\"\(error.localizedDescription)\"}\n", stderr)
            exit(1)
        }
    }

    // MARK: - Calendars

    static func printCalendars() async throws {
        _ = try await requestEventsAccessIfNeeded()
        let calendars = store.calendars(for: .event)
        let sources: [CalendarSourceInfo] = calendars.map { cal in
            CalendarSourceInfo(
                id: cal.calendarIdentifier,
                name: cal.title,
                color: colorString(from: cal.cgColor),
                accountName: cal.source?.title ?? "",
                type: "event"
            )
        }
        printJSON(sources)
    }

    // MARK: - Reminder Lists

    static func printReminderLists() async throws {
        _ = try await requestRemindersAccessIfNeeded()
        let calendars = store.calendars(for: .reminder)
        let sources: [CalendarSourceInfo] = calendars.map { cal in
            CalendarSourceInfo(
                id: cal.calendarIdentifier,
                name: cal.title,
                color: colorString(from: cal.cgColor),
                accountName: cal.source?.title ?? "",
                type: "reminder"
            )
        }
        printJSON(sources)
    }

    // MARK: - Events

    static func printEvents(from: String, to: String, calendarIDs: [String]) async throws {
        _ = try await requestEventsAccessIfNeeded()

        let fmt = ISO8601DateFormatter()
        guard let startDate = fmt.date(from: from),
              let endDate = fmt.date(from: to) else {
            fputs("{\"error\":\"Invalid date format. Use ISO 8601.\"}\n", stderr)
            exit(1)
        }

        let calendars: [EKCalendar]?
        if calendarIDs.isEmpty {
            calendars = nil  // all calendars
        } else {
            let filtered = store.calendars(for: .event).filter { calendarIDs.contains($0.calendarIdentifier) }
            calendars = filtered.isEmpty ? nil : filtered
        }

        let predicate = store.predicateForEvents(withStart: startDate, end: endDate, calendars: calendars)
        let ekEvents = store.events(matching: predicate)

        let events: [CalendianEvent] = ekEvents.map { ek in
            CalendianEvent(
                id: ek.eventIdentifier ?? "",
                calendarId: ek.calendar?.calendarIdentifier ?? "",
                calendarName: ek.calendar?.title ?? "",
                calendarColor: colorString(from: ek.calendar?.cgColor),
                accountName: ek.calendar?.source?.title ?? "",
                title: ek.title ?? "",
                start: ISO8601DateFormatter().string(from: ek.startDate),
                end: ISO8601DateFormatter().string(from: ek.endDate),
                isAllDay: ek.isAllDay,
                isRecurring: ek.hasRecurrenceRules,
                recurrenceSummary: ek.recurrenceRules?.map { $0.description }.joined(separator: "; ") ?? "",
                location: ek.location ?? "",
                url: ek.url?.absoluteString ?? "",
                notes: ek.notes ?? "",
                attendees: ek.attendees?.compactMap { $0.name ?? $0.url.absoluteString } ?? []
            )
        }
        printJSON(events.sorted { a, b in
            if a.isAllDay != b.isAllDay { return a.isAllDay }
            return a.start < b.start
        })
    }

    // MARK: - Reminders

    static func printReminders(from: String, to: String, listIDs: [String]) async throws {
        _ = try await requestRemindersAccessIfNeeded()

        let fmt = ISO8601DateFormatter()
        guard let startDate = fmt.date(from: from),
              let endDate = fmt.date(from: to) else {
            fputs("{\"error\":\"Invalid date format.\"}\n", stderr)
            exit(1)
        }

        let calendars: [EKCalendar]?
        if listIDs.isEmpty {
            calendars = nil
        } else {
            let filtered = store.calendars(for: .reminder).filter { listIDs.contains($0.calendarIdentifier) }
            calendars = filtered.isEmpty ? nil : filtered
        }

        let predicate = store.predicateForReminders(in: calendars)

        let reminders: [CalendianReminder] = await withCheckedContinuation { continuation in
            store.fetchReminders(matching: predicate) { ekReminders in
                let mapped = (ekReminders ?? [])
                    .filter { ekReminder in
                        // Filter by date range; no-date reminders handled by printNoDateReminders
                        guard let dueComps = ekReminder.dueDateComponents,
                              let dueDate = Calendar.current.date(from: dueComps) else {
                            return false
                        }
                        return dueDate >= startDate && dueDate <= endDate
                    }
                    .map { mapReminder($0) }
                continuation.resume(returning: mapped)
            }
        }

        printJSON(reminders)
    }

    // MARK: - No-date Reminders

    static func printNoDateReminders(listIDs: [String]) async throws {
        _ = try await requestRemindersAccessIfNeeded()

        let calendars: [EKCalendar]?
        if listIDs.isEmpty {
            calendars = nil
        } else {
            let filtered = store.calendars(for: .reminder).filter { listIDs.contains($0.calendarIdentifier) }
            calendars = filtered.isEmpty ? nil : filtered
        }

        let predicate = store.predicateForReminders(in: calendars)

        let reminders: [CalendianReminder] = await withCheckedContinuation { continuation in
            store.fetchReminders(matching: predicate) { ekReminders in
                let filtered = (ekReminders ?? []).filter { $0.dueDateComponents == nil }
                let mapped = filtered.map { mapReminder($0) }
                continuation.resume(returning: mapped)
            }
        }

        printJSON(reminders)
    }

    static func mapReminder(_ ek: EKReminder) -> CalendianReminder {
        let dueDateStr: String? = {
            guard let comps = ek.dueDateComponents,
                  let date = Calendar.current.date(from: comps) else { return nil }
            return ISO8601DateFormatter().string(from: date)
        }()
        let dueTimeStr: String? = {
            guard let comps = ek.dueDateComponents else { return nil }
            guard let h = comps.hour else { return nil }
            let m = comps.minute ?? 0
            return String(format: "%02d:%02d", h, m)
        }()

        let priorityStr: String = {
            switch ek.priority {
            case 1...4: return "high"
            case 5...6: return "medium"
            case 7...9: return "low"
            default: return "none"
            }
        }()

        return CalendianReminder(
            id: ek.calendarItemIdentifier,
            listId: ek.calendar?.calendarIdentifier ?? "",
            listName: ek.calendar?.title ?? "",
            title: ek.title ?? "",
            dueDate: dueDateStr,
            dueTime: dueTimeStr,
            priority: priorityStr,
            completed: ek.isCompleted,
            parentId: nil,
            notes: ek.notes ?? ""
        )
    }

    // MARK: - Toggle Reminder

    static func toggleReminder(_ reminderID: String) throws {
        guard let ekReminder = store.calendarItem(withIdentifier: reminderID) as? EKReminder else {
            fputs("{\"error\":\"Reminder not found\"}\n", stderr)
            exit(1)
        }
        ekReminder.isCompleted.toggle()
        ekReminder.completionDate = ekReminder.isCompleted ? Date() : nil
        try store.save(ekReminder, commit: true)
        printJSON(WriteResult(ok: true, id: reminderID, completed: ekReminder.isCompleted))
    }

    // MARK: - Create Event

    static func createEvent(title: String, startISO: String, endISO: String,
                            calendarID: String, isAllDay: Bool,
                            location: String, notes: String, url: String) async throws {
        _ = try await requestEventsAccessIfNeeded()

        let fmt = ISO8601DateFormatter()
        guard let startDate = fmt.date(from: startISO),
              let endDate = fmt.date(from: endISO) else {
            fputs("{\"error\":\"Invalid date format. Use ISO 8601.\"}\n", stderr)
            exit(1)
        }

        guard let calendar = store.calendars(for: .event).first(where: { $0.calendarIdentifier == calendarID }) else {
            fputs("{\"error\":\"Calendar not found: \(calendarID)\"}\n", stderr)
            exit(1)
        }

        let ekEvent = EKEvent(eventStore: store)
        ekEvent.title = title
        ekEvent.startDate = startDate
        ekEvent.endDate = endDate
        ekEvent.isAllDay = isAllDay
        ekEvent.calendar = calendar
        if !location.isEmpty { ekEvent.location = location }
        if !notes.isEmpty { ekEvent.notes = notes }
        if !url.isEmpty, let eventURL = URL(string: url) { ekEvent.url = eventURL }

        try store.save(ekEvent, span: .thisEvent, commit: true)
        printJSON(WriteResult(ok: true, id: ekEvent.eventIdentifier ?? "", completed: nil))
    }

    // MARK: - Create Reminder

    static func createReminder(title: String, listID: String, dueDate: String,
                               dueTime: String, priority: String, notes: String) async throws {
        _ = try await requestRemindersAccessIfNeeded()

        guard let calendar = store.calendars(for: .reminder).first(where: { $0.calendarIdentifier == listID }) else {
            fputs("{\"error\":\"Reminder list not found: \(listID)\"}\n", stderr)
            exit(1)
        }

        let ekReminder = EKReminder(eventStore: store)
        ekReminder.title = title
        ekReminder.calendar = calendar

        // Set due date components from ISO date + optional time
        if !dueDate.isEmpty {
            let fmt = ISO8601DateFormatter()
            if let date = fmt.date(from: dueDate) {
                let cal = Calendar.current
                var comps = cal.dateComponents([.year, .month, .day], from: date)
                if !dueTime.isEmpty {
                    let parts = dueTime.split(separator: ":")
                    if parts.count == 2,
                       let h = Int(parts[0]), let m = Int(parts[1]),
                       h >= 0 && h < 24 && m >= 0 && m < 60 {
                        comps.hour = h
                        comps.minute = m
                    }
                }
                ekReminder.dueDateComponents = comps
            }
        }

        // Set priority
        switch priority.lowercased() {
        case "high": ekReminder.priority = 1
        case "medium": ekReminder.priority = 5
        case "low": ekReminder.priority = 9
        default: ekReminder.priority = 0
        }

        if !notes.isEmpty { ekReminder.notes = notes }

        try store.save(ekReminder, commit: true)
        printJSON(WriteResult(ok: true, id: ekReminder.calendarItemIdentifier, completed: nil))
    }

    // MARK: - Edit Event (v0.4, REQ-WRITE-011)

    static func editEvent(eventID: String, title: String, startISO: String, endISO: String,
                          calendarID: String, isAllDay: Bool,
                          location: String, notes: String, url: String) async throws {
        _ = try await requestEventsAccessIfNeeded()

        guard let ekEvent = store.event(withIdentifier: eventID) else {
            fputs("{\"error\":\"Event not found: \(eventID)\"}\n", stderr)
            exit(1)
        }

        // Double-safety: reject recurring events at data layer
        if ekEvent.hasRecurrenceRules {
            fputs("{\"error\":\"Cannot edit recurring events from Calendian\"}\n", stderr)
            exit(1)
        }

        let fmt = ISO8601DateFormatter()
        if let startDate = fmt.date(from: startISO) { ekEvent.startDate = startDate }
        if let endDate = fmt.date(from: endISO) { ekEvent.endDate = endDate }

        ekEvent.title = title
        ekEvent.isAllDay = isAllDay

        // Move to different calendar if changed
        if let cal = store.calendars(for: .event).first(where: { $0.calendarIdentifier == calendarID }) {
            ekEvent.calendar = cal
        }

        ekEvent.location = location
        ekEvent.notes = notes
        if !url.isEmpty, let eventURL = URL(string: url) { ekEvent.url = eventURL }
        else { ekEvent.url = nil }

        try store.save(ekEvent, span: .thisEvent, commit: true)
        printJSON(WriteResult(ok: true, id: ekEvent.eventIdentifier ?? eventID, completed: nil))
    }

    // MARK: - Delete Event (v0.4, REQ-WRITE-012)

    static func deleteEvent(eventID: String) async throws {
        _ = try await requestEventsAccessIfNeeded()

        guard let ekEvent = store.event(withIdentifier: eventID) else {
            fputs("{\"error\":\"Event not found: \(eventID)\"}\n", stderr)
            exit(1)
        }

        if ekEvent.hasRecurrenceRules {
            fputs("{\"error\":\"Cannot delete recurring events from Calendian\"}\n", stderr)
            exit(1)
        }

        try store.remove(ekEvent, span: .thisEvent, commit: true)
        printJSON(WriteResult(ok: true, id: eventID, completed: nil))
    }

    // MARK: - Edit Reminder (v0.4, REQ-WRITE-017)

    static func editReminder(reminderID: String, title: String, listID: String,
                             dueDate: String, dueTime: String, priority: String,
                             notes: String) async throws {
        _ = try await requestRemindersAccessIfNeeded()

        guard let ekReminder = store.calendarItem(withIdentifier: reminderID) as? EKReminder else {
            fputs("{\"error\":\"Reminder not found: \(reminderID)\"}\n", stderr)
            exit(1)
        }

        ekReminder.title = title

        // Move to different list if changed
        if let cal = store.calendars(for: .reminder).first(where: { $0.calendarIdentifier == listID }) {
            ekReminder.calendar = cal
        }

        // Due date handling (same pattern as createReminder)
        if !dueDate.isEmpty {
            let fmt = ISO8601DateFormatter()
            if let date = fmt.date(from: dueDate) {
                let cal = Calendar.current
                var comps = cal.dateComponents([.year, .month, .day], from: date)
                if !dueTime.isEmpty {
                    let parts = dueTime.split(separator: ":")
                    if parts.count == 2,
                       let h = Int(parts[0]), let m = Int(parts[1]),
                       h >= 0 && h < 24 && m >= 0 && m < 60 {
                        comps.hour = h
                        comps.minute = m
                    }
                }
                ekReminder.dueDateComponents = comps
            }
        } else {
            ekReminder.dueDateComponents = nil  // clear due date
        }

        // Priority
        switch priority.lowercased() {
        case "high": ekReminder.priority = 1
        case "medium": ekReminder.priority = 5
        case "low": ekReminder.priority = 9
        default: ekReminder.priority = 0
        }

        if !notes.isEmpty { ekReminder.notes = notes }
        else { ekReminder.notes = nil }

        try store.save(ekReminder, commit: true)
        printJSON(WriteResult(ok: true, id: reminderID, completed: ekReminder.isCompleted))
    }

    // MARK: - Delete Reminder (v0.4, REQ-WRITE-018)

    static func deleteReminder(reminderID: String) async throws {
        _ = try await requestRemindersAccessIfNeeded()

        guard let ekReminder = store.calendarItem(withIdentifier: reminderID) as? EKReminder else {
            fputs("{\"error\":\"Reminder not found: \(reminderID)\"}\n", stderr)
            exit(1)
        }

        try store.remove(ekReminder, commit: true)
        printJSON(WriteResult(ok: true, id: reminderID, completed: nil))
    }

    // MARK: - Permissions

    static func printPermissions() {
        let eventStatus: String = {
            switch EKEventStore.authorizationStatus(for: .event) {
            case .authorized, .fullAccess: return "granted"
            case .denied, .restricted: return "denied"
            default: return "notDetermined"
            }
        }()
        let reminderStatus: String = {
            switch EKEventStore.authorizationStatus(for: .reminder) {
            case .authorized, .fullAccess: return "granted"
            case .denied, .restricted: return "denied"
            default: return "notDetermined"
            }
        }()
        printJSON(PermissionStatus(events: eventStatus, reminders: reminderStatus))
    }

    static func requestEventsAccess() async throws {
        let ok = try await store.requestFullAccessToEvents()
        printJSON(["granted": ok])
    }

    static func requestRemindersAccess() async throws {
        let ok = try await store.requestFullAccessToReminders()
        printJSON(["granted": ok])
    }

    static func requestEventsAccessIfNeeded() async throws -> Bool {
        let status = EKEventStore.authorizationStatus(for: .event)
        if status == .fullAccess { return true }
        return try await store.requestFullAccessToEvents()
    }

    static func requestRemindersAccessIfNeeded() async throws -> Bool {
        let status = EKEventStore.authorizationStatus(for: .reminder)
        if status == .fullAccess { return true }
        return try await store.requestFullAccessToReminders()
    }

    // MARK: - Watch (long-lived process for REQ-SYNC-005)

    static func watchChanges(signalFile: String) async throws {
        _ = try await requestEventsAccessIfNeeded()
        _ = try await requestRemindersAccessIfNeeded()

        // Write initial signal so JS knows we're watching
        writeSignal(signalFile)

        // Debounce: EKEventStoreChanged can fire rapidly during sync
        var lastSignal: Date = .distantPast
        let debounceMs: Double = 1000  // 1 second minimum between signals

        let stream = NotificationCenter.default.notifications(
            named: .EKEventStoreChanged,
            object: store
        )
        for await _ in stream {
            let now = Date()
            if now.timeIntervalSince(lastSignal) * 1000 >= debounceMs {
                writeSignal(signalFile)
                lastSignal = now
            }
        }
    }

    static func writeSignal(_ path: String) {
        let ts = ISO8601DateFormatter().string(from: Date())
        try? ts.write(toFile: path, atomically: true, encoding: .utf8)
    }

    // MARK: - Helpers

    static func colorString(from cgColor: CGColor?) -> String {
        guard let cg = cgColor else { return "" }
        let comps = cg.components ?? []
        if comps.count >= 3 {
            return "\(comps[0]),\(comps[1]),\(comps[2])"
        }
        return ""
    }

    static func printJSON<T: Encodable>(_ value: T) {
        do {
            let data = try encoder.encode(value)
            if let str = String(data: data, encoding: .utf8) {
                print(str)
            }
        } catch {
            fputs("{\"error\":\"JSON encode failed\"}\n", stderr)
        }
    }

    static func printUsage() {
        fputs("""
            Usage: calendian-helper <command> [args]

            Commands:
              calendars                          List event calendars (JSON)
              lists                              List reminder lists (JSON)
              events <from> <to> [ids...]        Fetch events (ISO 8601 dates)
              reminders <from> <to> [ids...]     Fetch reminders (ISO 8601 dates)
              reminders-nodate [ids...]          Fetch reminders without due date
              permissions                        Check authorization status
              request-events                     Request Calendar access
              request-reminders                  Request Reminders access
              toggle-reminder <id>               Toggle reminder completion
              create-event <title> <start> <end> <calId> <isAllDay> [location] [notes] [url]
              create-reminder <title> <listId> [dueDate] [dueTime] [priority] [notes]
              edit-event <id> <title> <start> <end> <calId> <isAllDay> [location] [notes] [url]
              delete-event <id>                  Delete a non-recurring event
              edit-reminder <id> <title> <listId> [dueDate] [dueTime] [priority] [notes]
              delete-reminder <id>               Delete a reminder
              watch [signal-file]                Watch for Calendar/Reminders changes (long-running)

            """, stderr)
    }
}
