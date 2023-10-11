import { Locale } from "../message/variants/Locale";
import { UserRole } from "./UsageManager";

export interface UserInFile {
  userId: string;
  userName: string;
  photoUrl: string | null;
  userStates: {
    [time: number]: {
      type: UserRole;
      actorId: string;
      entryType: 'request' | 'set' | 'reject';
    };
  };
  translations: {
    [time: number]: {
      chars: number;
      sourceLang: Locale;
      targetLang: Locale;
    };
  };
}
