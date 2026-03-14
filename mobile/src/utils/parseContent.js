import React from "react";
import { Text } from "react-native";

/**
 * Parse post content and make @mentions tappable.
 * Returns an array of React Native Text elements.
 *
 * @param {string} text - The raw post content
 * @param {object} options
 * @param {object} options.navigation - React Navigation navigation object
 * @param {string} options.accentColor - color for mentions (default: "#1d9bf0")
 * @param {object} options.baseStyle - base Text style to inherit
 */
export function parseContent(text, { navigation, accentColor = "#1d9bf0", baseStyle = {} } = {}) {
  if (!text) return null;

  // Global regex for splitting, non-global for testing individual parts
  const mentionSplitRegex = /(@[A-Za-z0-9_]{1,30})/g;
  const mentionTestRegex = /^@[A-Za-z0-9_]{1,30}$/;
  const parts = text.split(mentionSplitRegex);

  return parts.map((part, i) => {
    if (mentionTestRegex.test(part)) {
      const username = part.slice(1);
      return (
        <Text
          key={i}
          style={{ color: accentColor, fontWeight: "600" }}
          onPress={() => {
            if (navigation) navigation.navigate("Profile", { username });
          }}
        >
          {part}
        </Text>
      );
    }
    return <Text key={i}>{part}</Text>;
  });
}
