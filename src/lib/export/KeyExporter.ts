import ejs from 'ejs';
import { Locale } from '../message/variants/Locale';
import MessageStoreMemory from '../message/store/MessageStoreMemory';

const androidXmlExporterTmpl = ejs.compile(require('./templates/AndroidXmlExporter.ejs').default); // include the EJS template as a string
const appleStringsFileExporterTmpl = ejs.compile(require('./templates/AppleStringsFileExporter.ejs').default);
const appleDictFileExporterTmpl = ejs.compile(require('./templates/AppleDictFileExporter.ejs').default);

export default class KeyExporter {
  static export(messageStore: MessageStoreMemory, language: Locale, format: string, versionId: string | undefined) {
    // prepare the data needed by the templates
    const data = { input: messageStore.getMessagesByMessageName(language, versionId), language };

    if (format === 'apple-strings') {
      return {
        fileName: `${language}.strings`,
        fileType: 'application/xml',
        content: appleStringsFileExporterTmpl(data),
      };
    } if (format === 'apple-dict') {
      return {
        fileName: `${language}.dict`,
        fileType: 'application/xml',
        content: appleDictFileExporterTmpl(data),
      };
    } if (format === 'android-xml') {
      return {
        fileName: 'strings.xml',
        fileType: 'application/xml',
        content: androidXmlExporterTmpl(data),
      };
    }
    return undefined;
  }
}
