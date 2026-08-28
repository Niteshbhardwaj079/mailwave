// ---------------------------------------------------------------------------
// The sample file people can download before importing their own contacts.
// It answers the two questions everyone asks: "which column is the email?"
// and "what else can I put in the file?"
// ---------------------------------------------------------------------------

export const sampleColumns = [
  {
    key: 'name',
    header: 'Name',
    required: false,
    descKey: 'sample.colName',
    example: 'Rahul Verma',
  },
  {
    key: 'email',
    header: 'Email',
    required: true,
    descKey: 'sample.colEmail',
    example: 'rahul@example.com',
  },
  {
    key: 'phone',
    header: 'Phone',
    required: false,
    descKey: 'sample.colPhone',
    example: '+91 98200 11223',
  },
  {
    key: 'company',
    header: 'Company',
    required: false,
    descKey: 'sample.colCompany',
    example: 'Verma Traders',
  },
  {
    key: 'city',
    header: 'City',
    required: false,
    descKey: 'sample.colCity',
    example: 'Mumbai',
  },
];

export const sampleRows = [
  { name: 'Rahul Verma', email: 'rahul@example.com', phone: '+91 98200 11223', company: 'Verma Traders', city: 'Mumbai' },
  { name: 'Priya Nair', email: 'priya@example.com', phone: '+91 90000 77881', company: 'Nair Studio', city: 'Pune' },
  { name: 'Amit Kumar', email: 'amit@example.com', phone: '+91 98111 44556', company: 'Kumar Infotech', city: 'Delhi' },
];

export function buildSampleCsvRows() {
  const header = sampleColumns.map((column) => column.header);
  const body = sampleRows.map((row) => sampleColumns.map((column) => row[column.key]));
  return [header, ...body];
}
