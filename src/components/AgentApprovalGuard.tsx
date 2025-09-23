import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuthState } from '@/hooks/useAuthState';

interface AgentApprovalGuardProps {
  children: React.ReactNode;
}

export default function AgentApprovalGuard({ children }: AgentApprovalGuardProps) {
  const [isApproved, setIsApproved] = useState<boolean | null>(null);
  const [isCheckingApproval, setIsCheckingApproval] = useState(false);
  const { user, loading: authLoading, initialized } = useAuthState();
  const navigate = useNavigate();
  const [lastCheckedUserId, setLastCheckedUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const checkedUserIdRef = useRef<string | null>(null);
  const lastToastRef = useRef<number>(0);
  const lastToastKeyRef = useRef<string | null>(null);

  const safeToast = (type: 'error' | 'warning', message: string) => {
    const now = Date.now();
    const key = type + ':' + message;
    if (lastToastKeyRef.current === key && now - lastToastRef.current < 5000) return;
    lastToastKeyRef.current = key;
    lastToastRef.current = now;
    if (type === 'error') toast.error(message); else toast.warning(message);
  };
  useEffect(() => {
    if (!initialized) return;

    if (!user) {
      console.log('AgentApprovalGuard: No user found, redirecting to auth');
      navigate('/auth');
      return;
    }

    // Avoid re-checking repeatedly for the same user
    if (checkedUserIdRef.current === user.id) return;

    checkAgentApproval(user);
  }, [user, initialized, navigate]);

  const checkAgentApproval = async (authUser: any) => {
    setIsCheckingApproval(true);
    try {
      console.log('AgentApprovalGuard: Checking user:', authUser?.email);
      
      if (!authUser) {
        console.log('AgentApprovalGuard: No user provided');
        navigate('/auth');
        return;
      }

      // Check if user has admin role
      const { data: adminRole } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', authUser.id)
        .eq('role', 'admin')
        .maybeSingle();

      console.log('AgentApprovalGuard: Admin role check:', adminRole);

      if (adminRole) {
        console.log('AgentApprovalGuard: User is admin, granting access');
        setIsAdmin(true);
        setIsApproved(true);
        checkedUserIdRef.current = authUser.id;
        return;
      }

      // Check agent profile status
      const { data: profile, error } = await supabase
        .from('agent_profiles')
        .select('status')
        .eq('user_id', authUser.id)
        .maybeSingle();

      if (error || !profile) {
        safeToast('error', 'Unable to verify account status');
        setIsApproved(false);
      } else if (profile.status === 'approved') {
        setIsApproved(true);
      } else if (profile.status === 'pending') {
        setIsApproved(false);
        safeToast('warning', 'Your account is pending approval. Please wait for admin approval.');
      } else {
        setIsApproved(false);
        safeToast('error', 'Your account has been suspended. Please contact support.');
      }
      checkedUserIdRef.current = authUser.id;
    } catch (error) {
      console.error('Error checking agent approval:', error);
      setIsApproved(false);
    } finally {
      setIsCheckingApproval(false);
    }
  };

  // Show loading if auth is still initializing or we're checking approval
  if (authLoading || !initialized || isCheckingApproval || (isApproved === null && isAdmin === null)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isApproved) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="mb-6">
            <div className="mx-auto w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Account Pending Approval</h1>
            <p className="text-gray-600 mb-6">
              Your travel agent account is currently under review. You'll be notified once approved by our admin team.
            </p>
          </div>
          
          <button
            onClick={() => {
              supabase.auth.signOut();
              navigate('/auth');
            }}
            className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}