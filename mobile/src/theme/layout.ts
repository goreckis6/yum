import { ViewStyle } from 'react-native';

// The app is a single-column phone layout. On wide screens (iPad) we don't want
// content stretching edge-to-edge — that reads as a blown-up phone with absurdly
// long lines. Spreading `centeredContent` into a screen's scroll
// `contentContainerStyle` caps the column and centres it, while on phones
// (narrower than the cap) it just fills the width as before.
export const CONTENT_MAX_WIDTH = 640;

export const centeredContent: ViewStyle = {
  width: '100%',
  maxWidth: CONTENT_MAX_WIDTH,
  alignSelf: 'center',
};
