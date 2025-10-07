import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Clock, AlertCircle } from "lucide-react";

export default function EmailConfirm() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'confirmed' | 'pending' | 'approved' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    document.title = "Email Confirmation – Journey eSIM";
    handleEmailConfirmation();
  }, []);

  const handleEmailConfirmation = async () => {
    try {
      // First check URL hash for tokens (from email link)
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const hashAccessToken = hashParams.get('access_token');
      const hashRefreshToken = hashParams.get('refresh_token');
      
      // Also check query params
      const access_token = searchParams.get('access_token') || hashAccessToken;
      const refresh_token = searchParams.get('refresh_token') || hashRefreshToken;
      
      console.log('Email confirmation - tokens found:', { 
        hasAccessToken: !!access_token, 
        hasRefreshToken: !!refresh_token,
        source: hashAccessToken ? 'hash' : (searchParams.get('access_token') ? 'query' : 'none')
      });
      
      if (access_token && refresh_token) {
        console.log('Setting session with tokens...');
        
        // Set the session
        const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
          access_token,
          refresh_token
        });

        if (sessionError) {
          console.error('Session error:', sessionError);
          setStatus('error');
          setMessage('Invalid or expired confirmation link.');
          return;
        }

        console.log('Session established:', sessionData.session?.user?.email);

        // Get the user (should be available now)
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          console.error('No user after setting session');
          setStatus('error');
          setMessage('User not found.');
          return;
        }

        console.log('User confirmed:', user.email);

        // Wait a moment for the session to fully propagate
        await new Promise(resolve => setTimeout(resolve, 500));

        // Check agent profile status
        const { data: profile } = await supabase
          .from('agent_profiles')
          .select('status')
          .eq('user_id', user.id)
          .single();

        console.log('Agent profile status:', profile?.status);

        if (!profile) {
          setStatus('error');
          setMessage('Agent profile not found.');
          return;
        }

        if (profile.status === 'approved') {
          setStatus('approved');
          setMessage('Your account has been approved! You can now access the platform.');
        } else {
          setStatus('pending');
          setMessage('Thank you for confirming your email. Your account is pending admin approval.');
        }
      } else {
        console.log('No tokens in URL, checking existing session...');
        setStatus('confirmed');
        setMessage('Email confirmed successfully. Checking account status...');
        
        // Check if user is already logged in and their status
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          const { data: profile } = await supabase
            .from('agent_profiles')
            .select('status')
            .eq('user_id', user.id)
            .single();

          if (profile?.status === 'approved') {
            setStatus('approved');
            setMessage('Your account has been approved! You can now access the platform.');
          } else {
            setStatus('pending');
            setMessage('Your account is pending admin approval.');
          }
        } else {
          setStatus('error');
          setMessage('No active session found. Please sign in.');
        }
      }
    } catch (error) {
      console.error('Email confirmation error:', error);
      setStatus('error');
      setMessage('An error occurred during confirmation.');
    }
  };

  const getIcon = () => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="h-12 w-12 text-green-500" />;
      case 'pending':
      case 'confirmed':
        return <Clock className="h-12 w-12 text-yellow-500" />;
      case 'error':
        return <AlertCircle className="h-12 w-12 text-red-500" />;
      default:
        return <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />;
    }
  };

  const getTitle = () => {
    switch (status) {
      case 'approved':
        return 'Account Approved!';
      case 'pending':
      case 'confirmed':
        return 'Email Confirmed';
      case 'error':
        return 'Confirmation Failed';
      default:
        return 'Confirming Email...';
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md text-center">
        <CardHeader className="pb-4">
          <div className="flex justify-center mb-4">
            {getIcon()}
          </div>
          <CardTitle className="text-2xl">{getTitle()}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-muted-foreground">{message}</p>
          
          <div className="space-y-3">
            {status === 'approved' && (
              <Button 
                onClick={() => navigate('/dashboard')} 
                className="w-full"
              >
                Go to Dashboard
              </Button>
            )}
            
            {(status === 'pending' || status === 'confirmed') && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  You'll receive an email notification once your account is approved.
                </p>
                <Button 
                  variant="outline" 
                  onClick={() => window.location.reload()}
                  className="w-full"
                >
                  Check Status Again
                </Button>
              </div>
            )}
            
            <Button 
              variant="outline" 
              onClick={() => navigate('/auth')}
              className="w-full"
            >
              Back to Login
            </Button>
            
            {status !== 'loading' && (
              <Button 
                variant="ghost" 
                onClick={async () => {
                  await supabase.auth.signOut();
                  navigate('/auth');
                }}
                className="w-full text-sm"
              >
                Sign Out
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </main>
  );
}