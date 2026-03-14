import React from "react";

/**
 * Parse post content and make @mentions clickable.
 * Returns an array of React elements.
 *
 * @param {string} text - The raw post content
 * @param {object} options
 * @param {function} options.navigate - react-router navigate function
 * @param {string} options.accentColor - color for mentions (default: "#1d9bf0")
 */
export function parseContent(text, { navigate, accentColor = "#1d9bf0" } = {}) {
  if (!text) return null;

  // Match @username (alphanumeric + underscores, 1-30 chars)
  const mentionRegex = /(@[A-Za-z0-9_]{1,30})/g;
  const parts = text.split(mentionRegex);

  return parts.map((part, i) => {
    if (mentionRegex.test(part)) {
      // Reset regex lastIndex (since we reuse it)
      mentionRegex.lastIndex = 0;
      const username = part.slice(1); // remove @
      return (
        <span
          key={i}
          style={{
            color: accentColor,
            fontWeight: 600,
            cursor: "pointer",
          }}
          onClick={(e) => {
            e.stopPropagation();
            if (navigate) navigate(`/profile/${username}`);
          }}
        >
          {part}
        </span>
      );
    }
    // Reset regex lastIndex
    mentionRegex.lastIndex = 0;
    return <span key={i}>{part}</span>;
  });
}
