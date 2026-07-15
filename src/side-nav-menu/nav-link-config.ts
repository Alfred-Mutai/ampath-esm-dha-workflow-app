export const navLinksConfig = [
  {
    to: 'dashboard',
    title: 'Dashboard',
  },
  {
    to: 'registry',
    title: 'Registration',
  },
  {
    to: 'appointments',
    title: 'Appointments',
  },
  {
    to: 'triage',
    title: 'Triage',
  },
  {
    to: 'consultation',
    title: 'Consultation',
  },
  {
    to: 'mch',
    title: 'MCH',
    children: [
      {
        to: 'triage',
        title: 'Triage',
      },
      {
        to: 'consultation',
        title: 'Consultation',
      },
    ],
  },
  {
    to: 'admissions',
    title: 'Admissions',
  },
  {
    to: 'procedures',
    title: 'Procedures',
  },
  {
    to: 'radiology-imaging',
    title: 'Radiology and Imaging',
  },
  {
    to: 'laboratory',
    title: 'Laboratory',
  },
  {
    to: 'pharmacy',
    title: 'Pharmacy',
  },
  {
    to: 'mortuary',
    title: 'Mortuary',
  },
  {
    to: 'accounting',
    title: 'Accounting',
  },
  {
    to: 'reports',
    title: 'Reports',
  },
  {
    to: 'bookings',
    title: 'Bookings',
    children: [
      {
        to: 'daily',
        title: 'Daily',
      },
    ],
  },
];
