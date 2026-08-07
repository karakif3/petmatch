import * as Calendar from "expo-calendar";
import { Platform } from "react-native";

/**
 * Onaylanmış bir buluşmayı kullanıcının takvimine ekler.
 *
 * İzin yalnızca burada, kullanıcı düğmeye bastığında istenir — buluşma
 * onaylanmadan önce hiç çağrılmamalı (0043'ün "yalnızca onaylanmış
 * buluşmada" kuralı).
 */
export async function addMeetupToCalendar(input: {
  title: string;
  location: string;
  notes?: string;
  startDate: Date;
}): Promise<"added" | "denied"> {
  const permission = await Calendar.requestCalendarPermissionsAsync();
  if (!permission.granted) return "denied";

  const calendarId = await findWritableCalendarId();
  const endDate = new Date(input.startDate.getTime() + 60 * 60 * 1000);

  await Calendar.createEventAsync(calendarId, {
    title: input.title,
    location: input.location,
    notes: input.notes,
    startDate: input.startDate,
    endDate,
  });

  return "added";
}

async function findWritableCalendarId(): Promise<string> {
  if (Platform.OS === "ios") {
    const defaultCalendar = await Calendar.getDefaultCalendarAsync();
    return defaultCalendar.id;
  }

  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const writable = calendars.find((calendar) => calendar.allowsModifications);
  if (writable) return writable.id;

  const sources = await Calendar.getSourcesAsync();
  const localSource =
    sources.find((source) => source.type === Calendar.SourceType.LOCAL) ?? sources[0];

  return Calendar.createCalendarAsync({
    title: "PetMatch",
    color: "#F97362",
    entityType: Calendar.EntityTypes.EVENT,
    sourceId: localSource?.id,
    source: localSource,
    name: "petmatch",
    ownerAccount: "petmatch",
    accessLevel: Calendar.CalendarAccessLevel.OWNER,
  });
}
