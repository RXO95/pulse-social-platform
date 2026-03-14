import React, { createContext, useState, useContext } from 'react';

const FeedContext = createContext();

export const FeedProvider = ({ children }) => {
  const [posts, setPosts] = useState([]);
  const [hasFetched, setHasFetched] = useState(false);
  const [scrollPosition, setScrollPosition] = useState(0);

  return (
    <FeedContext.Provider
      value={{
        posts,
        setPosts,
        hasFetched,
        setHasFetched,
        scrollPosition,
        setScrollPosition,
      }}
    >
      {children}
    </FeedContext.Provider>
  );
};

export const useFeed = () => useContext(FeedContext);
