/** Phrases owned by the inventory screens. Merged over the base dictionary in ./dictionary.ts. */
import type { Translations } from '@truth-platform/ui'

export const INVENTORY: Translations = {
  en: {
    'inventory.description': 'Every event, its entities and its files. Pick industries, filter, open a row to see inside it.',
    'event.addFiles': 'Add files',
    'event.entities': 'Entities',
    'event.noEntities': 'No entity was added to this event yet.',
    'event.notLoaded': 'The event could not be loaded',
    'event.pickFile': 'Pick a file to preview it here',
    'edit.thisEvent': 'This event',
    'export.noFiles': 'The picked events carry no files to download',
    'entities.noFiles': 'The picked entities carry no files to download',
    'files.keptOf': '{kept} of {stored} kept',
    'files.detach': 'Remove',
    'files.undo': 'Undo',
    'files.detachWarning': '{count} file(s) will be detached when this edit is saved, and the change is recorded in the edit history.',
    'history.empty': 'Nothing was edited yet.',
  },
  he: {
    'inventory.description': 'כל האירועים, הישויות והקבצים שלהם. בחרו תעשיות, סננו, ופתחו שורה כדי לראות מה בתוכה.',
    'event.addFiles': 'הוספת קבצים',
    'event.entities': 'ישויות',
    'event.noEntities': 'עדיין לא נוספו ישויות לאירוע.',
    'event.notLoaded': 'לא ניתן היה לטעון את האירוע',
    'event.pickFile': 'בחרו קובץ כדי להציג אותו כאן',
    'edit.thisEvent': 'האירוע הזה',
    'export.noFiles': 'לאירועים שנבחרו אין קבצים להורדה',
    'entities.noFiles': 'לישויות שנבחרו אין קבצים להורדה',
    'files.keptOf': '{kept} מתוך {stored} נשמרים',
    'files.detach': 'הסרה',
    'files.undo': 'ביטול',
    'files.detachWarning': '{count} קבצים ינותקו כשהעריכה תישמר, והשינוי יירשם בהיסטוריית העריכה.',
    'history.empty': 'עדיין לא נערך דבר.',
  },
}
