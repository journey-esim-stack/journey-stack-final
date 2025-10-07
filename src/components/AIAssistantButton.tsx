import { useState } from 'react';
import { MessageSquare, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import AIPlanAssistant from '@/pages/AIPlanAssistant';

export default function AIAssistantButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-24 right-6 z-40 h-14 w-14 rounded-full shadow-lg hover:scale-110 transition-all duration-200 bg-gradient-to-br from-primary to-primary/80"
        size="icon"
      >
        <MessageSquare className="h-6 w-6" />
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-5xl h-[85vh] p-0 gap-0">
          <AIPlanAssistant onClose={() => setIsOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}
