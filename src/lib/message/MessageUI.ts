/* eslint-disable no-plusplus */
import { Locale } from './variants/Locale';

export interface MessageStoreUI {
  getBaseLanugage(): Locale | undefined;
}
