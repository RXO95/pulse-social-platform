import React, { createContext, useState, useContext } from 'react';

const FeedContext = createContext();

export const FeedProvider = ({ children }) => {
  const [posts, setPosts] = useState([]);
  const [hasFetched, setHasFetched] = useState(false);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(true);

  return (
    <FeedContext.Provider
      value={{
        posts,
        setPosts,
        hasFetched,
        setHasFetched,
        scrollPosition,
        setScrollPosition,
        nextCursor,
        setNextCursor,
        hasMore,
        setHasMore,
      }}
    >
      {children}
    </FeedContext.Provider>
  );
};

export const useFeed = () => useContext(FeedContext);
