import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export default function AuthConfirmed() {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Account Under Review – Journey eSIM";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', 'Your account is under review. You will be notified once approved.');
  }, []);

  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-6">
      <section className="w-full max-w-md bg-card border rounded-xl p-8 text-center shadow-lg">
        <div className="mx-auto w-16 h-16 rounded-full bg-yellow-500/10 flex items-center justify-center mb-4">
          <svg className="w-7 h-7 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold mb-2">Your account is under review</h1>
        <p className="text-muted-foreground mb-6">Thanks for confirming your email. Our team will approve your travel agent account shortly.</p>
        <div className="flex gap-3 justify-center">
          <button
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground"
            onClick={() => navigate('/auth')}
          >
            Back to Sign in
          </button>
          <button
            className="px-4 py-2 rounded-md border"
            onClick={async () => {
              await supabase.auth.signOut();
              navigate('/auth');
            }}
          >
            Sign out
          </button>
        </div>
      </section>
    </main>
  );
}
