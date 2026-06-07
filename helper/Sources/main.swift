import EventKit
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

        let predicate = store.predicateForIncompleteReminders(
            withDueDateStarting: startDate,
            ending: endDate,
            calendars: calendars
        )

        let reminders: [CalendianReminder] = await withCheckedContinuation { continuation in
            store.fetchReminders(matching: predicate) { ekReminders in
                let mapped = (ekReminders ?? []).map { mapReminder($0) }
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

        let predicate = store.predicateForIncompleteReminders(
            withDueDateStarting: nil as Date?,
            ending: nil as Date?,
            calendars: calendars
        )

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
            let h = comps.hour ?? 0
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
        printJSON(["ok": true, "completed": ekReminder.isCompleted])
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

            """, stderr)
    }
}
