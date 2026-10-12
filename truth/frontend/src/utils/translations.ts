/**
 * Everything this client says, in both languages.
 *
 * The shared library ships the vocabulary of the table itself - the filter chips, the pager, the viewers a
 * cell opens - and this adds the vocabulary of the register: what a row is, what the columns of it are
 * called, what the wizards ask for. The two are looked up through the same `t`, and this is registered
 * second, which is what lets a phrase here reword one of the library's: a register counts assumptions rather
 * than rows, and both are the same pagination bar.
 *
 * What is deliberately not here is the register's own vocabulary - the names of the industries, the names of
 * the schemas, the attributes a schema declares. Those are written by the people using the register, in
 * whichever language they chose, and translating them would mean inventing words for somebody else's data.
 * A declared attribute can carry a Hebrew name of its own, read by `utils/scheme`, and that is the only
 * place the register's own words are ever shown in two languages.
 */

import type { Translations } from '@truth-platform/core-ui'

const TRUTH_TRANSLATIONS: Translations = {
  en: {
    /* The application itself. */
    'app.name': 'TRUTH',
    'app.industries': 'INDUSTRIES',
    'app.allIndustries': 'All industries',
    'app.noIndustries': 'No industries yet',
    'app.more': 'More',
    'app.schemas': 'Schemas',
    'app.sections': 'Sections',

    /* The columns the API declares on every assumption, whatever schema it was written under. */
    'column.assumptionText': 'Assumption',
    'column.industry': 'Industry',
    'column.schemas': 'Schemas',
    'column.proposingParty': 'Proposing party',
    'column.validationBy': 'Validation by',
    'column.tags': 'Tags',
    'column.revision': 'Rev',
    'column.creator': 'Creator',
    'column.createdAt': 'Created at',

    /* The bar under the table counts assumptions rather than the rows the library counts by default. */
    'pagination.empty': 'No assumptions',
    'pagination.range': '{first} – {last} of {total} assumptions',

    /* The toolbar above the register. */
    'register.searchPlaceholder': 'Search',
    'register.chooseColumns': 'Choose the columns',
    'register.columns': 'Columns',
    'register.export': 'Export',
    'register.exportSheet': 'Spreadsheet of this view',
    'register.exportBundle': 'Bundle, to import into another register',
    'register.import': 'Import',
    'register.newAssumption': 'ASSUMPTION',
    'register.emptyNarrowed': 'No assumptions match the search.',
    'register.empty': 'No assumptions have been created yet.',
    'register.exported': 'The current view was exported',
    'register.reading': 'Reading assumption details — {done} of {total}.',

    /* The panel that opens underneath a row. */
    'detail.validation': 'Validation',
    'detail.open': 'Open assumption',
    'detail.gone': 'The assumption is no longer on the page.',
    'detail.createdBy': '{moment} by {creator}',
    'detail.noValidations': 'No validation responsible parties are recorded.',
    'detail.state': 'State',
    'detail.archived': 'Archived',
    'detail.removed': 'Removed',

    /* The industries, which are the way into the register. */
    'industries.title': 'Industries',
    'industries.empty': 'No industries have been created yet.',
    'industries.new': 'INDUSTRY',
    'industries.one': 'assumption',
    'industries.many': 'assumptions',
    'industries.counting': 'counting…',
    'industries.back': 'Back to the industries',
    'industries.fallbackName': 'Industry',

    /* Declaring an industry. */
    'industry.create': 'New industry',
    'industry.name': 'Name',
    'industry.created': 'The industry was created',

    /* The schemas, which declare what an assumption carries. */
    'schemas.title': 'Schemas',
    'schemas.note': 'A schema declares the attributes an assumption carries. Changing one creates a new revision.',
    'schemas.empty': 'No schemas have been declared yet.',
    'schemas.new': 'SCHEMA',
    'schemas.search': 'Search schemas',
    'schemas.noMatch': 'No schemas match that search.',
    'schemas.declare': 'Declare a schema',
    'schemas.reviseNamed': 'Revise {name}',
    'schemas.namePlaceholder': 'What the schema is called',
    'schemas.descriptionPlaceholder': 'What it declares and when to use it…',
    'schemas.reasonPlaceholder': 'Why the declaration is being changed',
    'form.select': 'Select',
    'schemas.keyRequired': 'A key is required',
    'schemas.revision': 'rev {number}',
    'schemas.back': 'Back to the schemas',
    'schemas.revise': 'Revise',
    'schemas.attributes': 'Attributes',
    'schemas.addAttribute': 'Add attribute',
    'schemas.firstAttribute': 'No attributes yet.',
    'schemas.key': 'Key',
    'schemas.type': 'Type',
    'schemas.required': 'Required',
    'schemas.many': 'Many values',
    'schemas.options': 'Options',
    'schemas.optionsRequired': 'At least one option is needed',
    'schemas.min': 'Min',
    'schemas.max': 'Max',
    'schemas.step': 'Step',
    'schemas.optional': 'Optional',
    'schemas.removeAttribute': 'Remove {name}',
    'schemas.thisAttribute': 'this attribute',
    'schemas.revisionReason': 'Reason for the revision',
    'schemas.noAttributes': 'The schema declares no attributes.',
    'schemas.noAttributesToFill': 'No attributes to fill in.',

    /* Creating an assumption. */
    'create.title': 'New assumption',
    'create.create': 'Create',
    'create.created': 'The assumption was created',
    'create.text': 'Assumption',
    'create.proposingParty': 'Proposing party',
    'create.industries': 'Industries',
    'create.tags': 'Tags',
    'create.validators': 'Validation by',
    'create.noFields': 'The chosen schemas declare no attributes.',
    'create.partyPlaceholder': 'Who is proposing it',
    'create.industriesPlaceholder': 'Which industries it belongs to',
    'create.textPlaceholder': 'State the condition, the figure or the behaviour being taken as true…',
    'industry.namePlaceholder': 'What the industry is called',
    'industry.descriptionPlaceholder': 'What it covers…',

    /* Restoring a bundle. */
    'import.title': 'Import a bundle',
    'import.note':
      'A bundle exported from this register or from another one. Everything in it that is not already here ' +
      'is created: the industries, then the schemas, then the assumptions.',
    'import.pick': 'Bundle file',
    'import.restore': 'Restore',
    'import.cancel': 'Close',
    'import.unreadable': 'That file is not a readable bundle.',
    'import.summary': 'The bundle holds {industries} industries, {schemas} schemas and {assumptions} assumptions.',
    'import.willCreate': '{industries} industries, {schemas} schemas and {assumptions} assumptions will be created.',
    'import.alreadyHere': '{count} of them are already here and will be left alone.',
    'import.running': 'Restoring — {done} of {total}.',
    'import.done': 'Restored {created} of {total}. {failed} could not be written.',
    'import.doneClean': 'Restored {created} of {total}.',
    'import.failures': 'What could not be written',

    /* The panel opened underneath a row. */
    'detail.party': 'Party',
    'detail.role': 'Role',
    'detail.filter': 'Filter',
    'detail.proposing': 'Proposing',
    'detail.validating': 'Validating',
    'detail.filterBy': 'Show the assumptions of {party}',
    'detail.unfilter': 'Clear this filter',
    'detail.revision': 'Revision {revision}',

    /* The page of one assumption. */
    'assumption.badge': 'ASSUMPTION',
    'assumption.back': 'Back to the industry',
    'assumption.attribute': 'Attribute',
    'assumption.value': 'Value',
    'assumption.schema': 'Schema',
    'assumption.unreadable': 'The assumption could not be read',

    /* The schemas, beyond the builder. */
    'schemas.badge': 'SCHEMA',
    'schemas.name': 'Schema name',
    'schemas.nameRequired': 'A schema needs a name',
    'schemas.reasonRequired': 'Say why it is being revised',
    'schemas.allIndustries': 'Every industry',
    'schemas.global': 'Global schema',
    'schemas.globalShort': 'Global',
    'schemas.allowed': 'Allowed values',
    'schemas.attributeCount': '{count} attributes',
    'schemas.attributeCountOne': '1 attribute',
    'schemas.declared': '{name} was declared',
    'schemas.revised': '{name} was revised',
    'schemas.unreadable': 'The schema could not be read',

    /* Creating an assumption. */
    'create.fields': 'Schema fields',
    'create.pickIndustry': 'Pick an industry to fill in the fields its schemas declare.',
    'create.textRequired': 'Write the assumption',
    'create.partyRequired': 'Say who is proposing it',
    'create.industriesRequired': 'Pick at least one industry',
    'form.fixProblems': 'Some fields still need attention',
    'industry.nameRequired': 'An industry needs a name',

    /* What a number may hold, said beside the field. */
    'bounds.between': '{min} to {max}',
    'bounds.atLeast': '{min} or more',
    'bounds.atMost': '{max} or less',
    'bounds.step': 'in steps of {step}',

    /* What is wrong with a value, said under the field. */
    'check.required': '{name} is required',
    'check.number': '{name} must be a number',
    'check.whole': '{name} must be a whole number',
    'check.min': '{name} must be at least {min}',
    'check.max': '{name} must be at most {max}',
    'check.step': '{name} must go up in steps of {step}',
    'check.stepFrom': '{name} must go up in steps of {step} from {min}',
    'check.oneOf': '{name} must be one of: {options}',
  },
  he: {
    'app.name': 'TRUTH',
    'app.industries': 'תעשיות',
    'app.allIndustries': 'כל התעשיות',
    'app.noIndustries': 'עדיין אין תעשיות',
    'app.more': 'עוד',
    'app.schemas': 'סכמות',
    'app.sections': 'ניווט',

    'column.assumptionText': 'הנחה',
    'column.industry': 'תעשייה',
    'column.schemas': 'סכמות',
    'column.proposingParty': 'הגורם המציע',
    'column.validationBy': 'אחראי אימות',
    'column.tags': 'תגיות',
    'column.revision': 'גרסה',
    'column.creator': 'יוצר',
    'column.createdAt': 'תאריך יצירה',

    'pagination.empty': 'אין הנחות',
    'pagination.range': 'מוצגות {first} עד {last} מתוך {total} הנחות',

    'register.searchPlaceholder': 'חיפוש',
    'register.chooseColumns': 'בחירת העמודות',
    'register.columns': 'עמודות',
    'register.export': 'ייצוא',
    'register.exportSheet': 'גיליון של התצוגה הנוכחית',
    'register.exportBundle': 'חבילה לייבוא במערכת אחרת',
    'register.import': 'ייבוא',
    'register.newAssumption': 'הנחה',
    'register.emptyNarrowed': 'אין הנחות התואמות לחיפוש.',
    'register.empty': 'עדיין לא נוצרו הנחות.',
    'register.exported': 'התצוגה יוצאה לקובץ',
    'register.reading': 'נטענים פרטי ההנחות — {done} מתוך {total}.',

    'detail.validation': 'אימות',
    'detail.open': 'פתיחת ההנחה',
    'detail.gone': 'ההנחה כבר אינה בעמוד.',
    'detail.createdBy': '{moment} על ידי {creator}',
    'detail.noValidations': 'לא נרשמו אחראים לאימות.',
    'detail.state': 'מצב',
    'detail.archived': 'בארכיון',
    'detail.removed': 'הוסר',

    'industries.title': 'תעשיות',
    'industries.empty': 'עדיין לא נוצרו תעשיות.',
    'industries.new': 'תעשייה',
    'industries.one': 'הנחה',
    'industries.many': 'הנחות',
    'industries.counting': 'בספירה…',
    'industries.back': 'חזרה לתעשיות',
    'industries.fallbackName': 'תעשייה',

    'industry.create': 'תעשייה חדשה',
    'industry.name': 'שם',
    'industry.created': 'התעשייה נוצרה',

    'schemas.title': 'סכמות',
    'schemas.note': 'סכמה מגדירה את המאפיינים של הנחה. שינוי בה יוצר גרסה חדשה.',
    'schemas.empty': 'עדיין לא הוגדרו סכמות.',
    'schemas.new': 'סכמה',
    'schemas.search': 'חיפוש סכמות',
    'schemas.noMatch': 'אין סכמות התואמות לחיפוש.',
    'schemas.declare': 'הגדרת סכמה',
    'schemas.reviseNamed': 'גרסה חדשה של {name}',
    'schemas.namePlaceholder': 'שם קצר וברור',
    'schemas.descriptionPlaceholder': 'מה היא מגדירה ומתי משתמשים בה…',
    'schemas.reasonPlaceholder': 'מה השתנה ולמה',
    'form.select': 'בחירה',
    'schemas.keyRequired': 'יש להזין מפתח',
    'schemas.revision': 'גרסה {number}',
    'schemas.back': 'חזרה לסכמות',
    'schemas.revise': 'גרסה חדשה',
    'schemas.attributes': 'מאפיינים',
    'schemas.addAttribute': 'הוספת מאפיין',
    'schemas.firstAttribute': 'עדיין אין מאפיינים.',
    'schemas.key': 'מפתח',
    'schemas.type': 'סוג',
    'schemas.required': 'חובה',
    'schemas.many': 'מרובה ערכים',
    'schemas.options': 'אפשרויות',
    'schemas.optionsRequired': 'נדרשת לפחות אפשרות אחת',
    'schemas.min': 'מינימום',
    'schemas.max': 'מקסימום',
    'schemas.step': 'צעד',
    'schemas.optional': 'לא חובה',
    'schemas.removeAttribute': 'הסרת {name}',
    'schemas.thisAttribute': 'המאפיין הזה',
    'schemas.revisionReason': 'סיבת העדכון',
    'schemas.noAttributes': 'הסכמה אינה מגדירה מאפיינים.',
    'schemas.noAttributesToFill': 'אין מאפיינים למילוי.',

    'create.title': 'הנחה חדשה',
    'create.create': 'יצירה',
    'create.created': 'ההנחה נוצרה',
    'create.text': 'ההנחה',
    'create.proposingParty': 'הגורם המציע',
    'create.industries': 'תעשיות',
    'create.tags': 'תגיות',
    'create.validators': 'אחראי אימות',
    'create.noFields': 'לסכמות שנבחרו אין מאפיינים למילוי.',
    'create.partyPlaceholder': 'מי מציע אותה',
    'create.industriesPlaceholder': 'לאילו תעשיות היא שייכת',
    'create.textPlaceholder': 'נסחו את התנאי, הנתון או ההתנהגות שמניחים כנכונים…',
    'industry.namePlaceholder': 'שם התעשייה',
    'industry.descriptionPlaceholder': 'מה היא מכסה…',

    'import.title': 'ייבוא חבילה',
    'import.note':
      'חבילה שיוצאה מכאן או ממערכת אחרת. כל מה שאינו קיים כאן ייווצר: תחילה התעשיות, אחריהן הסכמות ' +
      'ולבסוף ההנחות.',
    'import.pick': 'קובץ החבילה',
    'import.restore': 'שחזור',
    'import.cancel': 'סגירה',
    'import.unreadable': 'הקובץ אינו חבילה תקינה.',
    'import.summary': 'בחבילה — תעשיות: {industries}, סכמות: {schemas}, הנחות: {assumptions}.',
    'import.willCreate': 'ייווצרו — תעשיות: {industries}, סכמות: {schemas}, הנחות: {assumptions}.',
    'import.alreadyHere': 'כבר קיימות ויישארו כפי שהן: {count}.',
    'import.running': 'משחזר — {done} מתוך {total}.',
    'import.done': 'שוחזרו {created} מתוך {total}. לא נכתבו: {failed}.',
    'import.doneClean': 'שוחזרו {created} מתוך {total}.',
    'import.failures': 'פריטים שלא נכתבו',

    'detail.party': 'גורם',
    'detail.role': 'תפקיד',
    'detail.filter': 'סינון',
    'detail.proposing': 'מציע',
    'detail.validating': 'מאמת',
    'detail.filterBy': 'הצגת ההנחות של {party}',
    'detail.unfilter': 'הסרת הסינון',
    'detail.revision': 'גרסה {revision}',

    'assumption.badge': 'הנחה',
    'assumption.back': 'חזרה לתעשייה',
    'assumption.attribute': 'מאפיין',
    'assumption.value': 'ערך',
    'assumption.schema': 'סכמה',
    'assumption.unreadable': 'לא ניתן לקרוא את ההנחה',

    'schemas.badge': 'סכמה',
    'schemas.name': 'שם הסכמה',
    'schemas.nameRequired': 'יש להזין שם לסכמה',
    'schemas.reasonRequired': 'יש לציין את סיבת העדכון',
    'schemas.allIndustries': 'כל התעשיות',
    'schemas.global': 'סכמה גלובלית',
    'schemas.globalShort': 'גלובלית',
    'schemas.allowed': 'ערכים מותרים',
    'schemas.attributeCount': 'מאפיינים: {count}',
    'schemas.attributeCountOne': 'מאפיין אחד',
    'schemas.declared': 'הסכמה {name} הוגדרה',
    'schemas.revised': 'הסכמה {name} עודכנה',
    'schemas.unreadable': 'לא ניתן לקרוא את הסכמה',

    'create.fields': 'שדות הסכמה',
    'create.pickIndustry': 'בחרו תעשייה כדי למלא את שדות הסכמות שלה.',
    'create.textRequired': 'יש לכתוב את ההנחה',
    'create.partyRequired': 'יש לציין את הגורם המציע',
    'create.industriesRequired': 'יש לבחור לפחות תעשייה אחת',
    'form.fixProblems': 'יש שדות שדורשים תיקון',
    'industry.nameRequired': 'יש להזין שם לתעשייה',

    'bounds.between': 'בין {min} ל־{max}',
    'bounds.atLeast': '{min} ומעלה',
    'bounds.atMost': 'עד {max}',
    'bounds.step': 'בצעדים של {step}',

    'check.required': 'חובה למלא את {name}',
    'check.number': 'הערך של {name} חייב להיות מספר',
    'check.whole': 'הערך של {name} חייב להיות מספר שלם',
    'check.min': 'הערך של {name} חייב להיות לפחות {min}',
    'check.max': 'הערך של {name} חייב להיות לכל היותר {max}',
    'check.step': 'הערך של {name} חייב לעלות בצעדים של {step}',
    'check.stepFrom': 'הערך של {name} חייב לעלות בצעדים של {step} החל מ־{min}',
    'check.oneOf': 'הערך של {name} חייב להיות אחד מהערכים: {options}',

    /*
     * Hebrew for words the shared library ships, said the way this register says them.
     *
     * Registered second and therefore winning, exactly as the pager's own count does - and kept here rather
     * than corrected in the library because the inventory beside this client is written in the same words
     * and none of them is this client's to move. Only the Hebrew is here; the English of each is the
     * library's and is looked up there.
     */
    'operator.equals': 'שווה ל־',
    'operator.not_equals': 'שונה מ־',
    'operator.starts_with': 'מתחיל ב־',
    'operator.ends_with': 'מסתיים ב־',
    'operator.greater_than': 'גדול מ־',
    'operator.greater_or_equal': 'לפחות',
    'operator.less_than': 'קטן מ־',
    'operator.not_in': 'אינו אחד מתוך',
    'operator.is_not_empty': 'אינו ריק',
    'filters.noMatch': 'אין ערך התואם ל"{term}".',
    'input.pressEnter': 'Enter אחרי כל ערך',
    'common.unsavedBody': 'השינויים שנעשו כאן לא נשמרו ויאבדו.',
    'names.required': 'יש למלא לפחות שם אחד',
    'names.keyEnglish': 'אותיות באנגלית, ספרות וקו תחתון בלבד',
    'grid.pinLeft': 'נעיצה משמאל',
    'grid.pinRight': 'נעיצה מימין',
  },
}

export { TRUTH_TRANSLATIONS }
