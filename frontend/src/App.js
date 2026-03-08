import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Feed from "./pages/Feed";
import Profile from "./pages/Profile";
import PostDetail from "./pages/PostDetail";
import EntityExplore from "./pages/EntityExplore";
import Bookmarks from "./pages/Bookmarks";
import Trending from "./pages/Trending";
import FollowList from "./pages/FollowList";
import Messages from "./pages/Messages";
import Settings from "./pages/Settings";
import Compose from "./pages/Compose";
import ProtectedRoute from "./components/ProtectedRoute";
import SidebarLayout from "./components/SidebarLayout";

export default function App() {
  return (
    <ThemeProvider>
    <AuthProvider>
      <BrowserRouter>
        <Routes>

          <Route path="/" element={<Navigate to="/login" />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />

          {/* All protected routes share the sidebar layout */}
          <Route element={<ProtectedRoute><SidebarLayout /></ProtectedRoute>}>
            <Route path="/feed" element={<Feed />} />
            <Route path="/profile/:username" element={<Profile />} />
            <Route path="/post/:postId" element={<PostDetail />} />
            <Route path="/entity/:entityText" element={<EntityExplore />} />
            <Route path="/bookmarks" element={<Bookmarks />} />
            <Route path="/trending" element={<Trending />} />
            <Route path="/messages" element={<Messages />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/compose" element={<Compose />} />
            <Route path="/profile/:username/:type" element={<FollowList />} />
          </Route>

        </Routes>
      </BrowserRouter>
    </AuthProvider>
    </ThemeProvider>
  );
}