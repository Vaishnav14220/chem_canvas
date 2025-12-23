import { useState } from 'react';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Input } from '../ui/input';

export function AddSourceDialog(props: {
  onAddUrl: (url: string) => void | Promise<void>;
  onAddFile: (file: File) => void | Promise<void>;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={props.disabled} className="w-full">
          Add Source
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Source</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Website URL</label>
            <div className="flex gap-2 mt-1">
              <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com" />
              <Button
                onClick={async () => {
                  const v = url.trim();
                  if (!v) return;
                  await props.onAddUrl(v);
                  setUrl('');
                  setOpen(false);
                }}
              >
                Add
              </Button>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">PDF / TXT file</label>
            <input
              type="file"
              accept=".pdf,.txt"
              className="mt-2 block w-full text-sm"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                await props.onAddFile(file);
                setOpen(false);
              }}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

