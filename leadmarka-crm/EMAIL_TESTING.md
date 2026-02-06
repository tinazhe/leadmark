# Email Testing Checklist

Use this checklist to validate responsive email rendering across major clients and devices after template changes.

## Preview and Validation
- Send a test email through Resend using each template type:
  - Follow-up reminder
  - Daily summary
  - Lead assigned / reassigned
  - Password reset
  - Workspace invite / added
- Confirm subject lines and preheaders are visible and accurate.
- Verify CTA links go to the correct destinations.

## Mobile (Small Screens)
- iOS Mail (iPhone) and Gmail (iPhone)
- Android Gmail and Outlook
- Check for:
  - No horizontal scrolling
  - Readable font sizes
  - Touch targets at least 44px tall
  - Buttons stack and fill width when needed

## Desktop Clients
- Gmail (web)
- Outlook (web)
- Apple Mail (macOS)
- Check for:
  - Layout centered with max width
  - Consistent spacing and typography
  - Logo rendering and alignment

## Dark Mode
- iOS Mail dark mode
- Gmail dark mode
- Confirm text remains legible and backgrounds do not invert to poor contrast.

## Accessibility
- Ensure text contrast remains readable.
- Verify links are distinguishable and have descriptive labels.

## Regression Notes
- If any layout regressions are found, update `backend/services/reminderService.js` styles or specific email body blocks and re-test.
