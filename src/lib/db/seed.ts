/**
 * Seed data: the default pack, the household bills questions, and the
 * rejection reasons.
 *
 * Every client-facing string in this file must be free of contractions.
 * "We are", not "we're". This is enforced by a test.
 */

// ---------------------------------------------------------------------------
// Advisers
//
// Five advisers at Secured Lending Options. Every adviser can see every case;
// the dashboard defaults to "my cases" but the filter can be cleared, which is
// what makes holiday and sickness cover work.
//
// These names appear at the foot of client-facing emails, so this file is the
// single source of truth for them. Correct them here rather than in the
// database, because the seed script overwrites the database from this list.
// ---------------------------------------------------------------------------

export const ADVISERS = [
  { name: 'Lauren McCallum', email: 'lauren@sloptions.co.uk' },
  { name: 'Craig Gallacher', email: 'craig@sloptions.co.uk' },
  { name: 'David Orr', email: 'david@sloptions.co.uk' },
  { name: 'Kevin Prentice', email: 'kevin@sloptions.co.uk' },
  { name: 'Gary Thomson', email: 'gary@sloptions.co.uk' },
] as const

export const FIRM_NAME = 'Secured Lending Options'

// ---------------------------------------------------------------------------
// Household bills - a flat list, rebuilt natively from the retired Typeform.
// All nineteen are mandatory. Zero is a valid answer; blank is not.
// ---------------------------------------------------------------------------

export const HOUSEHOLD_BILL_FIELDS = [
  { key: 'council_tax', label: 'Council tax' },
  { key: 'gas_electricity', label: 'Gas and electricity' },
  { key: 'water', label: 'Water' },
  { key: 'ground_rent', label: 'Ground rent, service or leasehold charge' },
  { key: 'tv_broadband', label: 'TV and broadband' },
  { key: 'phone', label: 'Landline and mobile phone' },
  { key: 'food', label: 'Food' },
  { key: 'fuel', label: 'Fuel' },
  { key: 'car_insurance', label: 'Car insurance' },
  { key: 'car_maintenance', label: 'Car maintenance' },
  { key: 'public_transport', label: 'Public transport' },
  { key: 'recreation', label: 'Recreation and socialising' },
  { key: 'clothing', label: 'Clothing' },
  { key: 'buildings_contents', label: 'Buildings and contents insurance' },
  { key: 'private_insurance', label: 'Private insurance policies' },
  { key: 'childcare', label: 'Childcare' },
  { key: 'maintenance', label: 'Maintenance payable' },
  { key: 'private_education', label: 'Private education' },
  { key: 'other_living', label: 'Any other living costs' },
] as const

// ---------------------------------------------------------------------------
// The default pack
// ---------------------------------------------------------------------------

export type TemplateItem = {
  key: string
  type: 'upload' | 'question' | 'question_group'
  label: string
  description: string
  /** true means one copy of this item is created for each applicant */
  perApplicant: boolean
  /** true means this item only appears on joint applications */
  jointOnly: boolean
  /**
   * Who the item belongs to, where that is not obvious.
   *
   * Per-applicant items work it out for themselves and everything else belongs
   * to the case as a whole, so this is only needed for the odd item that
   * belongs to one named applicant without being duplicated for the other.
   */
  applicantSlot?: 'applicant_1' | 'applicant_2' | 'joint'
  isMandatory: boolean
  sortOrder: number
  /** number of files or pages expected, where it is known up front */
  expectedCount?: number
  /** the expected count and label are set by the client's employment type */
  employmentDependent?: boolean
  /** sub-fields for question and question_group items */
  fields?: ReadonlyArray<{ key: string; label: string }>
}

export const DEFAULT_TEMPLATE: TemplateItem[] = [
  {
    key: 'slo_documents',
    type: 'upload',
    label: 'Your signed SLO documents',
    description:
      'Please download the document, print the 4 highlighted pages, sign/date them and send them back. If this loan application is in joint names, you both need to sign/date. We only require the 4 signed pages to be returned, and a clear photo of each of the pages is fine.',
    perApplicant: false,
    jointOnly: false,
    isMandatory: true,
    sortOrder: 1,
    expectedCount: 4,
  },
  {
    key: 'identification',
    type: 'upload',
    label: 'Photo identification',
    description:
      'A clear photo of either your passport or your driving licence, with all four corners showing and no fingers over the document.',
    perApplicant: true,
    jointOnly: false,
    isMandatory: true,
    sortOrder: 2,
  },
  {
    key: 'income_evidence',
    type: 'upload',
    label: 'Proof of your income',
    description:
      'If you are employed we need your three most recent monthly payslips, or your twelve most recent weekly payslips. If you are self employed we need your last two years of SA302s together with the Tax Year Overview for each of those years.',
    perApplicant: true,
    jointOnly: false,
    isMandatory: true,
    sortOrder: 3,
    employmentDependent: true,
  },
  {
    key: 'dependants',
    type: 'question',
    label: 'Dependents',
    description: 'Do you have any dependents? If so, please let us know their ages.',
    perApplicant: false,
    jointOnly: false,
    isMandatory: true,
    sortOrder: 4,
    fields: [
      { key: 'has_dependants', label: 'Do you have any dependents?' },
      { key: 'ages', label: 'Their ages' },
    ],
  },
  {
    key: 'applicant_2_contact',
    type: 'question',
    label: 'Contact details for the second applicant',
    description:
      'We require the email address and mobile number for {{applicant_2_name}} for the application.',
    perApplicant: false,
    jointOnly: true,
    applicantSlot: 'applicant_2',
    isMandatory: true,
    sortOrder: 5,
    fields: [
      // The name is captured when the case is created, so only these two are
      // still being asked for.
      { key: 'partner_email', label: 'Email address' },
      { key: 'partner_mobile', label: 'Mobile number' },
    ],
  },
  {
    key: 'employment_details',
    type: 'question',
    label: 'Your employment details',
    description:
      'If you are employed, we require your job title, the name of the company you work for, and the date you joined. If you are self employed, we need to know whether you are a sole trader or a limited company, the company name if it is limited, and how many years you have been self employed.',
    perApplicant: true,
    jointOnly: false,
    isMandatory: true,
    sortOrder: 6,
    fields: [
      { key: 'job_title', label: 'Job title' },
      { key: 'employer_name', label: 'Name of the company you work for' },
      { key: 'joined_date', label: 'Date you joined the company' },
      { key: 'trading_style', label: 'Sole trader or limited company' },
      { key: 'company_name', label: 'Company name, if limited' },
      { key: 'years_self_employed', label: 'Years in self employment' },
    ],
  },
  {
    key: 'home_improvements',
    type: 'question',
    label: 'Loan Purpose',
    description:
      'In terms of the {{home_improvement_amount}} for home improvements, what home improvements are you carrying out? We require a rough breakdown for the application eg £10k new bathroom, £10k new windows, £5k garden renovations, £5k general décor upgrade, £3k internal doors etc',
    perApplicant: false,
    jointOnly: false,
    isMandatory: true,
    sortOrder: 7,
    fields: [{ key: 'breakdown', label: 'Rough breakdown' }],
  },
  {
    key: 'bank_details',
    type: 'question',
    label: 'Bank Details',
    description:
      'The bank details you would like the cash to be sent to. Name on account, account number and sort code.',
    perApplicant: false,
    jointOnly: false,
    isMandatory: true,
    sortOrder: 8,
    fields: [
      { key: 'account_name', label: 'Name on the account' },
      { key: 'sort_code', label: 'Sort code' },
      { key: 'account_number', label: 'Account number' },
    ],
  },
  {
    key: 'household_bills',
    type: 'question_group',
    label: 'Your monthly household bills',
    description:
      'Please let us know how much you pay each month for the following household bills. If any of the items do not apply to you, please enter zero.',
    perApplicant: false,
    jointOnly: false,
    isMandatory: true,
    sortOrder: 9,
    fields: HOUSEHOLD_BILL_FIELDS,
  },
]

// ---------------------------------------------------------------------------
// Rejection reasons
// ---------------------------------------------------------------------------

export type RejectionReason = {
  label: string
  emailCopy: string
  smsCopy: string
  sortOrder: number
}

export const DEFAULT_REJECTION_REASONS: RejectionReason[] = [
  {
    label: 'Too blurry to read',
    emailCopy:
      'Thank you for sending that over. Unfortunately it is too blurry for us to read. Please take another photo in good light, holding the camera steady, and upload it here: {{link}}',
    smsCopy:
      'Hi {{first_name}} - thank you for that, but it is too blurry for us to read. Please try again here: {{link}}',
    sortOrder: 1,
  },
  {
    label: 'Page missing',
    emailCopy:
      'Thank you for sending that over. There is a page missing, so please send the remaining page or pages and we will get straight on with it: {{link}}',
    smsCopy:
      'Hi {{first_name}} - thank you for that, but there is a page missing. Please send the rest here: {{link}}',
    sortOrder: 2,
  },
  {
    label: 'Not the most recent 3 months',
    emailCopy:
      'Thank you for sending your payslips. We do need the three most recent months and the ones you have sent are from earlier in the year. Please upload your last three payslips here: {{link}}',
    smsCopy:
      'Hi {{first_name}} - thank you for the payslips, but we need your three most recent months. Please re-upload here: {{link}}',
    sortOrder: 3,
  },
  {
    label: 'Tax Year Overview missing',
    emailCopy:
      'Thank you for sending your SA302s. We also need the Tax Year Overview that goes with each year. These are two separate documents and you can download both from your HMRC online account. Please upload the Tax Year Overviews here: {{link}}',
    smsCopy:
      'Hi {{first_name}} - thank you for the SA302s. We also need the Tax Year Overview for each year. Please upload here: {{link}}',
    sortOrder: 4,
  },
  {
    label: 'Wrong document',
    emailCopy:
      'Thank you for sending that over. It looks like a different document to the one we need for this item. Please have another look at what we have asked for and upload it here: {{link}}',
    smsCopy:
      'Hi {{first_name}} - thank you, but that is a different document to the one we need. Please check and re-upload here: {{link}}',
    sortOrder: 5,
  },
  {
    label: 'Out of date',
    emailCopy:
      'Thank you for sending that over. Unfortunately it is out of date for what the lender will accept. Please send us a more recent version here: {{link}}',
    smsCopy:
      'Hi {{first_name}} - thank you, but that document is out of date. Please send a more recent one here: {{link}}',
    sortOrder: 6,
  },
  {
    label: 'Does not match the application details',
    emailCopy:
      'Thank you for sending that over. The name or address on it does not match the details on your application, so the lender will not accept it. Please send something that matches, or let us know if your details have changed: {{link}}',
    smsCopy:
      'Hi {{first_name}} - the details on that document do not match your application. Please get in touch or upload another here: {{link}}',
    sortOrder: 7,
  },
  {
    label: 'Account number or sort code not visible',
    emailCopy:
      'Thank you for sending that over. We cannot see the full account number and sort code, and the lender needs both to be visible. Please send a version that shows them here: {{link}}',
    smsCopy:
      'Hi {{first_name}} - we cannot see the full account number and sort code on that. Please re-upload here: {{link}}',
    sortOrder: 8,
  },
  {
    label: 'Screenshot instead of the bank PDF',
    emailCopy:
      'Thank you for sending that over. The lender will not accept a screenshot from a banking app. Please download the official PDF statement from your online banking and upload that instead: {{link}}',
    smsCopy:
      'Hi {{first_name}} - the lender cannot accept a screenshot. Please download the official PDF from your banking app and upload it here: {{link}}',
    sortOrder: 9,
  },
  {
    label: 'Cropped, header not showing',
    emailCopy:
      'Thank you for sending that over. The top of the document has been cut off and we need to see the header. Please take another photo showing the whole page and upload it here: {{link}}',
    smsCopy:
      'Hi {{first_name}} - the top of that document is cut off. Please send the whole page here: {{link}}',
    sortOrder: 10,
  },
]
