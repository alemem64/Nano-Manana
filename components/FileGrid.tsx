"use client";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { FileCard } from "@/components/FileCard";
import { useAppStore } from "@/store/useAppStore";
import { useTranslation } from "@/i18n/useTranslation";
import { ArrowDownAZ, ArrowUpZA } from "lucide-react";

export function FileGrid() {
  const t = useTranslation();
  const { files, sortOrder, setFiles, toggleSortOrder } = useAppStore();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = files.findIndex((f) => f.id === active.id);
      const newIndex = files.findIndex((f) => f.id === over.id);
      
      if (oldIndex !== -1 && newIndex !== -1) {
        const newFiles = arrayMove(files, oldIndex, newIndex).map((f, idx) => ({
          ...f,
          order: idx,
        }));
        setFiles(newFiles);
      }
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Sort controls */}
      <div className="flex items-center justify-between mb-4 px-1">
        <p className="text-sm text-sec">
          {files.length} {files.length === 1 ? "file" : "files"}
        </p>
        <button
          onClick={toggleSortOrder}
          className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium bg-sec text-sec hover:bg-ter transition-colors"
        >
          {sortOrder === "asc" ? (
            <>
              <ArrowDownAZ className="h-4 w-4" />
              {t.sort.aToZ}
            </>
          ) : (
            <>
              <ArrowUpZA className="h-4 w-4" />
              {t.sort.zToA}
            </>
          )}
        </button>
      </div>

      {/* File grid */}
      <div className="flex-1 overflow-y-auto">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={files.map((f) => f.id)}
            strategy={rectSortingStrategy}
          >
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pb-4">
              {files.map((file, index) => (
                <FileCard key={file.id} file={file} index={index} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
}
