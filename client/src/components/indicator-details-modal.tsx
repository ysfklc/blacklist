import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDistanceToNow } from "date-fns";
import IndicatorNotes from "./indicator-notes";

interface Indicator {
  id: number;
  value: string;
  type: string;
  source: string;
  isActive: boolean;
  notesCount?: number;
  tempActiveUntil?: string | null;
  createdAt: string;
  createdByUser?: string;
}

interface IndicatorDetailsModalProps {
  indicator: Indicator | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function IndicatorDetailsModal({ 
  indicator, 
  isOpen, 
  onClose 
}: IndicatorDetailsModalProps) {
  if (!indicator) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Indicator Details
            <Badge variant={indicator.isActive ? "default" : "secondary"}>
              {indicator.isActive ? "Active" : "Inactive"}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>Information</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-600">Value</label>
                <p className="text-lg font-mono break-all">{indicator.value}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Type</label>
                <p className="capitalize">{indicator.type}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Source</label>
                <p>{indicator.source}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Status</label>
                <div className="flex flex-col space-y-1">
                  <Badge variant={indicator.isActive ? "default" : "secondary"}>
                    {indicator.isActive ? "Active" : "Inactive"}
                  </Badge>
                  {indicator.tempActiveUntil && indicator.isActive && (
                    <Badge variant="outline" className="bg-yellow-50 border-yellow-200 text-yellow-800">
                      Temporary until {formatDistanceToNow(new Date(indicator.tempActiveUntil))} from now
                    </Badge>
                  )}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Created</label>
                <p>{formatDistanceToNow(new Date(indicator.createdAt))} ago</p>
              </div>
              {indicator.createdByUser && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Created By</label>
                  <p>{indicator.createdByUser}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Notes Section */}
          <IndicatorNotes indicatorId={indicator.id} />
        </div>
      </DialogContent>
    </Dialog>
  );
}