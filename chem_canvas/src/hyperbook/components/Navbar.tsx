import { Plus } from 'lucide-react';
import { Button } from '../ui/button';

export function Navbar(props: { onCreateNotebook?: () => void }) {
  return (
    <header className="flex items-center justify-between px-3 sm:px-6 py-2 sm:py-3 border-b border-gray-200 bg-white text-black">
      <div />

      <div className="flex items-center gap-2 sm:gap-4">
        <Button
          variant="outline"
          className="bg-black text-white hover:bg-gray-800 hover:text-white border-none font-medium h-8 sm:h-9 px-2 sm:px-4 gap-1 sm:gap-2 text-xs sm:text-sm"
          onClick={() => props.onCreateNotebook?.()}
        >
          <Plus className="h-3 w-3 sm:h-4 sm:w-4" />
          <span className="hidden sm:inline">Create Notebook</span>
          <span className="sm:hidden">New</span>
        </Button>
      </div>
    </header>
  );
}
