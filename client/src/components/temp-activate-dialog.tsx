import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface TempActivateDialogProps {
  indicatorId: number | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function TempActivateDialog({ 
  indicatorId, 
  isOpen, 
  onClose 
}: TempActivateDialogProps) {
  const [durationHours, setDurationHours] = useState<number>(6);
  const [customHours, setCustomHours] = useState<string>("");
  const [durationType, setDurationType] = useState<string>("preset");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const tempActivateMutation = useMutation({
    mutationFn: async (data: { durationHours: number }) => {
      return apiRequest("POST", `/api/indicators/${indicatorId}/temp-activate`, data);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Indicator temporarily activated",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/indicators"] });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to activate indicator",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    let finalHours = durationHours;
    if (durationType === "custom") {
      finalHours = parseInt(customHours);
      if (isNaN(finalHours) || finalHours <= 0 || finalHours > 168) {
        toast({
          title: "Error",
          description: "Duration must be between 1 and 168 hours",
          variant: "destructive",
        });
        return;
      }
    }
    
    tempActivateMutation.mutate({ durationHours: finalHours });
  };

  const handleClose = () => {
    setDurationHours(6);
    setCustomHours("");
    setDurationType("preset");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Extend Activation Period
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="duration-type">Duration</Label>
            <Select value={durationType} onValueChange={setDurationType}>
              <SelectTrigger>
                <SelectValue placeholder="Select duration type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="preset">Preset Duration</SelectItem>
                <SelectItem value="custom">Custom Duration</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {durationType === "preset" && (
            <div className="space-y-2">
              <Label htmlFor="preset-hours">Select Duration</Label>
              <Select value={durationHours.toString()} onValueChange={(value) => setDurationHours(parseInt(value))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 Hour</SelectItem>
                  <SelectItem value="2">2 Hours</SelectItem>
                  <SelectItem value="6">6 Hours</SelectItem>
                  <SelectItem value="12">12 Hours</SelectItem>
                  <SelectItem value="24">24 Hours (1 Day)</SelectItem>
                  <SelectItem value="48">48 Hours (2 Days)</SelectItem>
                  <SelectItem value="72">72 Hours (3 Days)</SelectItem>
                  <SelectItem value="168">168 Hours (1 Week)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {durationType === "custom" && (
            <div className="space-y-2">
              <Label htmlFor="custom-hours">Hours (1-168)</Label>
              <Input
                id="custom-hours"
                type="number"
                min="1"
                max="168"
                value={customHours}
                onChange={(e) => setCustomHours(e.target.value)}
                placeholder="Enter hours"
              />
            </div>
          )}

          <div className="bg-blue-50 p-3 rounded-lg">
            <p className="text-sm text-blue-700">
              This indicator will remain active for the specified duration, then automatically be deleted. 
              The system checks for expired temporary indicators every minute.
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={tempActivateMutation.isPending}>
              {tempActivateMutation.isPending ? "Activating..." : "Activate"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}