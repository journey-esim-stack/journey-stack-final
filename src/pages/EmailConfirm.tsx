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
      // Get the tokens from URL
      const access_token = searchParams.get('access_token');
      const refresh_token = searchParams.get('refresh_token');
      
      if (access_token && refresh_token) {
        // Set the session
        const { error: sessionError } = await supabase.auth.setSession({
          access_token,
          refresh_token
        });

        if (sessionError) {
          setStatus('error');
          setMessage('Invalid or expired confirmation link.');
          return;
        }

        // Get the user
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          setStatus('error');
          setMessage('User not found.');
          return;
        }

        // Check agent profile status
        const { data: profile } = await supabase
          .from('agent_profiles')
          .select('status')
          .eq('user_id', user.id)
          .single();

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