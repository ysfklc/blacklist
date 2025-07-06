import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Edit, Trash2, Save, X, Plus } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface IndicatorNote {
  id: number;
  content: string;
  isEdited: boolean;
  editedAt: string | null;
  createdAt: string;
  updatedAt: string;
  user: {
    id: number;
    username: string;
  };
}

interface IndicatorNotesProps {
  indicatorId: number;
  legacyNote?: string | null;
}

export default function IndicatorNotes({ indicatorId, legacyNote }: IndicatorNotesProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [newNoteContent, setNewNoteContent] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState("");

  // Fetch notes for this indicator
  const { data: notes, isLoading } = useQuery<IndicatorNote[]>({
    queryKey: [`/api/indicators/${indicatorId}/notes`],
    staleTime: 0,
  });

  // Add note mutation
  const addNoteMutation = useMutation({
    mutationFn: (content: string) => 
      apiRequest("POST", `/api/indicators/${indicatorId}/notes`, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/indicators/${indicatorId}/notes`] });
      setIsAddingNote(false);
      setNewNoteContent("");
      toast({
        title: "Success",
        description: "Note added successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add note",
        variant: "destructive",
      });
    },
  });

  // Update note mutation
  const updateNoteMutation = useMutation({
    mutationFn: ({ noteId, content }: { noteId: number; content: string }) =>
      apiRequest("PUT", `/api/indicator-notes/${noteId}`, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/indicators/${indicatorId}/notes`] });
      setEditingNoteId(null);
      setEditContent("");
      toast({
        title: "Success",
        description: "Note updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update note",
        variant: "destructive",
      });
    },
  });

  // Delete note mutation
  const deleteNoteMutation = useMutation({
    mutationFn: (noteId: number) =>
      apiRequest("DELETE", `/api/indicator-notes/${noteId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/indicators/${indicatorId}/notes`] });
      toast({
        title: "Success",
        description: "Note deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete note",
        variant: "destructive",
      });
    },
  });

  const handleAddNote = () => {
    if (newNoteContent.trim()) {
      addNoteMutation.mutate(newNoteContent.trim());
    }
  };

  const handleEditNote = (note: IndicatorNote) => {
    setEditingNoteId(note.id);
    setEditContent(note.content);
  };

  const handleSaveEdit = () => {
    if (editingNoteId && editContent.trim()) {
      updateNoteMutation.mutate({
        noteId: editingNoteId,
        content: editContent.trim(),
      });
    }
  };

  const handleCancelEdit = () => {
    setEditingNoteId(null);
    setEditContent("");
  };

  const handleDeleteNote = (noteId: number) => {
    if (confirm("Are you sure you want to delete this note?")) {
      deleteNoteMutation.mutate(noteId);
    }
  };

  const canEditNote = (note: IndicatorNote) => {
    return user?.id === note.user.id;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Notes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Notes ({(notes?.length || 0) + (legacyNote ? 1 : 0)})
          </div>
          {!isAddingNote && (
            <Button
              onClick={() => setIsAddingNote(true)}
              size="sm"
              variant="outline"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Note
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add note form */}
        {isAddingNote && (
          <div className="border rounded-lg p-4 bg-gray-50">
            <Textarea
              placeholder="Add a note..."
              value={newNoteContent}
              onChange={(e) => setNewNoteContent(e.target.value)}
              className="mb-3"
              rows={3}
            />
            <div className="flex gap-2">
              <Button
                onClick={handleAddNote}
                disabled={!newNoteContent.trim() || addNoteMutation.isPending}
                size="sm"
              >
                <Save className="h-4 w-4 mr-1" />
                Save Note
              </Button>
              <Button
                onClick={() => {
                  setIsAddingNote(false);
                  setNewNoteContent("");
                }}
                variant="outline"
                size="sm"
              >
                <X className="h-4 w-4 mr-1" />
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Notes list */}
        {(legacyNote || (notes && notes.length > 0)) ? (
          <div className="space-y-3">
            {/* Legacy Note (if exists) */}
            {legacyNote && (
              <div className="border rounded-lg p-4 bg-amber-50 border-amber-200">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2 text-sm text-amber-700">
                    <span className="font-medium">Legacy Note</span>
                    <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-800">
                      imported
                    </Badge>
                  </div>
                </div>
                <p className="text-gray-800 whitespace-pre-wrap">{legacyNote}</p>
                <p className="text-xs text-amber-600 mt-2">
                  This note was imported from the legacy system. Consider adding a new note with current information.
                </p>
              </div>
            )}
            
            {/* Regular Notes */}
            {notes?.map((note) => (
              <div key={note.id} className="border rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="font-medium">{note.user.username}</span>
                    <span>•</span>
                    <span>{formatDistanceToNow(new Date(note.createdAt))} ago</span>
                    {note.isEdited && (
                      <>
                        <span>•</span>
                        <Badge variant="secondary" className="text-xs">
                          edited
                        </Badge>
                      </>
                    )}
                  </div>
                  {canEditNote(note) && (
                    <div className="flex gap-1">
                      <Button
                        onClick={() => handleEditNote(note)}
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0"
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button
                        onClick={() => handleDeleteNote(note.id)}
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>

                {editingNoteId === note.id ? (
                  <div className="space-y-3">
                    <Textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      rows={3}
                    />
                    <div className="flex gap-2">
                      <Button
                        onClick={handleSaveEdit}
                        disabled={!editContent.trim() || updateNoteMutation.isPending}
                        size="sm"
                      >
                        <Save className="h-4 w-4 mr-1" />
                        Save
                      </Button>
                      <Button
                        onClick={handleCancelEdit}
                        variant="outline"
                        size="sm"
                      >
                        <X className="h-4 w-4 mr-1" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-800 whitespace-pre-wrap">{note.content}</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No notes yet. Add the first note for this indicator.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}