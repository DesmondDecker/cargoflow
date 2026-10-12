export interface GuideStep {
  title: string;
  description: string;
}

export interface Guide {
  id: string;
  icon: string;
  title: string;
  summary: string;
  steps: GuideStep[];
}

export const GUIDES: Guide[] = [
  {
    id: 'getting-started',
    icon: '🚀',
    title: 'Getting Started',
    summary: 'Set up your agency and add your team.',
    steps: [
      {
        title: 'Register your agency',
        description:
          'From the welcome screen, choose "Register a New Agency." You\'ll become the owner and receive a unique agency code — write it down.',
      },
      {
        title: 'Set your agency password',
        description: 'Choose a password when registering. This is shared with your staff so they can join — keep it safe, and change it any time from More → Agency.',
      },
      {
        title: 'Add your staff',
        description: 'Give each staff member your agency code and password. They join from the welcome screen with "Join an Agency" and enter their own name — that name is what shows up in every activity log.',
      },
    ],
  },
  {
    id: 'track-container',
    icon: '📦',
    title: 'Tracking a Container',
    summary: 'Register a container and understand its case file.',
    steps: [
      {
        title: 'Register the container',
        description: 'Add the container number, link it to a Bill of Lading and importer. CargoFlow automatically checks the container number is valid and tries to identify the shipping line.',
      },
      {
        title: 'Update dates as they happen',
        description: 'Set arrival, discharge, and clearance dates as they occur. Deadlines (like the Bolloré period) are calculated automatically from these dates.',
      },
      {
        title: 'Watch the attention badge',
        description: 'Every container shows Urgent, Attention, or Normal. Urgent and Attention containers need action — check the reasons listed on the case file.',
      },
    ],
  },
  {
    id: 'documents',
    icon: '📄',
    title: 'Managing Documents',
    summary: 'Upload and track required paperwork.',
    steps: [
      {
        title: 'Upload from a container\'s case file',
        description: 'Open a container, scroll to Documents, and add a file for any missing document type — Bill of Lading, Delivery Order, CTN, and more.',
      },
      {
        title: 'Re-uploading creates a new version',
        description: 'If you need to replace a document, the old version is kept — nothing is overwritten, so you always have the full history.',
      },
      {
        title: 'Missing documents drive alerts',
        description: 'A container missing a required document (like a CTN) shows up in the daily digest and on the dashboard — not just buried in the case file.',
      },
    ],
  },
  {
    id: 'drivers',
    icon: '🚚',
    title: 'Finding & Assigning a Driver',
    summary: 'Arrange transport once a container is cleared.',
    steps: [
      {
        title: 'Find a driver',
        description: 'From a cleared container\'s case file, tap "Find Driver" to see verified drivers whose vehicles match the container\'s size.',
      },
      {
        title: 'Assign the job',
        description: 'Pick a driver and vehicle, set the pickup and destination, and assign. The driver receives the job on their own app to accept or decline.',
      },
      {
        title: 'Track delivery',
        description: 'Once the driver accepts, the container status updates automatically as they pick up and deliver — with photo/signature proof of delivery at the end.',
      },
    ],
  },
  {
    id: 'alerts',
    icon: '🔔',
    title: 'Understanding Alerts',
    summary: 'What Urgent and Attention actually mean.',
    steps: [
      {
        title: 'Urgent (red)',
        description: 'A deadline has expired, a required document is missing at a late pipeline stage, or a container has sat far too long without progress.',
      },
      {
        title: 'Attention (amber)',
        description: 'A deadline is due within 3 days, documents are missing earlier in the process, or there\'s been no activity in 5+ days.',
      },
      {
        title: 'The daily digest',
        description: 'Every morning, CargoFlow refreshes every container and summarizes what changed — check the Dashboard tab first thing.',
      },
    ],
  },
];
