import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export default function TestAuth() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    const { data: { user }, error } = await supabase.auth.getUser();
    console.log("Current user:", user, "Error:", error);
    setUser(user);
    setLoading(false);
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="p-8">
      <h1>Auth Test Page</h1>
      {user ? (
        <div>
          <p>✅ Authenticated as: {user.email}</p>
          <p>User ID: {user.id}</p>
          <Link to="/plans" className="text-blue-500 underline">Go to Plans</Link>
        </div>
      ) : (
        <div>
          <p>❌ Not authenticated</p>
          <Link to="/auth" className="text-blue-500 underline">Go to Auth</Link>
        </div>
      )}
    </div>
  );
}