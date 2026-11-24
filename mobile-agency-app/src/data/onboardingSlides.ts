export interface OnboardingSlide {
  icon: string;
  title: string;
  description: string;
}

export const ONBOARDING_SLIDES: OnboardingSlide[] = [
  {
    icon: '📦',
    title: 'Container Tracking',
    description:
      'Enter a container or B/L number and CargoFlow automatically finds the shipping line, tracks the status, and shows real-time updates.',
  },
  {
    icon: '📄',
    title: 'Document Management',
    description: 'Scan, upload, and organize all your shipping documents with automatic identification and easy access — nothing gets lost.',
  },
  {
    icon: '🚚',
    title: 'Find a Driver',
    description: 'Connect with verified drivers and vehicles, assign jobs, track deliveries, and get proof of delivery — all in one place.',
  },
  {
    icon: '🛃',
    title: 'Customs Verification',
    description: 'Send transaction details for review, track pending submissions, and see approval references or corrections in the Customs tab.',
  },
  {
    icon: '🔔',
    title: 'Smart Alerts & Deadlines',
    description:
      'Get notified about free-time deadlines, missing documents, inactivity and other critical updates before they become costly.',
  },
];
