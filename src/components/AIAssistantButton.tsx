import { useState } from 'react';
import { MessageSquare, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import AIPlanAssistant from '@/pages/AIPlanAssistant';

export default function AIAssistantButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Floating button */}
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-24 right-6 z-40 h-14 w-14 rounded-full shadow-lg hover:scale-110 transition-all duration-200 bg-gradient-to-br from-primary to-primary/80"
        size="icon"
      >
        <MessageSquare className="h-6 w-6" />
      </Button>

      {/* Chat window in corner */}
      {isOpen && (
        <Card className="fixed bottom-24 right-6 z-50 w-[450px] h-[600px] shadow-2xl border-2 overflow-hidden">
          <div className="relative h-full">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(false)}
              className="absolute top-2 right-2 z-10 rounded-full"
            >
              <X className="h-4 w-4" />
            </Button>
            <AIPlanAssistant onClose={() => setIsOpen(false)} />
          </div>
        </Card>
      )}
    </>
  );
}
