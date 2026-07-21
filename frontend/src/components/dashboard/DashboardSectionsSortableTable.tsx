import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Loader2, Pencil, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { getGraphTypeLabel, getMetricLabels, getSourceTypeLabel } from "@/lib/dashboardConfig";
import type { DashboardSectionSummary } from "@/lib/dashboardsApi";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";

interface DashboardSectionsSortableTableProps {
  dashboardId: number;
  sections: DashboardSectionSummary[];
  editable: boolean;
  savingOrder: boolean;
  onReorder: (sections: DashboardSectionSummary[]) => void;
  onDelete: (section: DashboardSectionSummary) => void;
}

interface SortableSectionRowProps {
  dashboardId: number;
  section: DashboardSectionSummary;
  editable: boolean;
  dragDisabled: boolean;
  onDelete: (section: DashboardSectionSummary) => void;
}

function SortableSectionRow({
  dashboardId,
  section,
  editable,
  dragDisabled,
  onDelete,
}: SortableSectionRowProps) {
  const metricLabels = getMetricLabels(section.metrics);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section.id,
    disabled: !editable || dragDisabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={cn("hover:bg-muted/30", isDragging && "bg-muted/40 opacity-80")}
    >
      {editable ? (
        <td className="w-10 px-2 py-3">
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground flex size-8 cursor-grab items-center justify-center rounded-md active:cursor-grabbing"
            aria-label={`Drag to reorder ${section.name}`}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="size-4" />
          </button>
        </td>
      ) : null}
      <td className="px-4 py-3 font-medium">{section.name}</td>
      <td className="text-muted-foreground px-4 py-3">{getGraphTypeLabel(section.graphType)}</td>
      <td className="text-muted-foreground px-4 py-3">
        {getSourceTypeLabel(section.sourceType)}
      </td>
      <td className="text-muted-foreground px-4 py-3">
        {section.metrics.map((metric) => metricLabels[metric] ?? metric).join(", ")}
      </td>
      <td className="text-muted-foreground px-4 py-3">{section.sourceItemCount}</td>
      {editable ? (
        <td className="px-4 py-3 text-right">
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" asChild>
              <Link
                to={routes.dashboardSectionEdit(String(dashboardId), String(section.id))}
              >
                <Pencil className="size-4" />
                Edit
              </Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => onDelete(section)}
            >
              <Trash2 className="size-4" />
              Delete
            </Button>
          </div>
        </td>
      ) : null}
    </tr>
  );
}

export function DashboardSectionsSortableTable({
  dashboardId,
  sections,
  editable,
  savingOrder,
  onReorder,
  onDelete,
}: DashboardSectionsSortableTableProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = sections.findIndex((section) => section.id === active.id);
    const newIndex = sections.findIndex((section) => section.id === over.id);
    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    onReorder(arrayMove(sections, oldIndex, newIndex));
  };

  return (
    <div className="space-y-2">
      {editable ? (
        <p className="text-muted-foreground text-xs">
          Drag rows using the handle to change section order on the dashboard.
          {savingOrder ? (
            <span className="ml-2 inline-flex items-center gap-1">
              <Loader2 className="size-3 animate-spin" />
              Saving order...
            </span>
          ) : null}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-lg border">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <table className="min-w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                {editable ? <th className="w-10 px-2 py-3" aria-label="Reorder" /> : null}
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">Chart type</th>
                <th className="px-4 py-3 text-left font-medium">Source</th>
                <th className="px-4 py-3 text-left font-medium">Metrics</th>
                <th className="px-4 py-3 text-left font-medium">Items</th>
                {editable ? (
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                ) : null}
              </tr>
            </thead>
            <SortableContext
              items={sections.map((section) => section.id)}
              strategy={verticalListSortingStrategy}
            >
              <tbody className="divide-y divide-border">
                {sections.map((section) => (
                  <SortableSectionRow
                    key={section.id}
                    dashboardId={dashboardId}
                    section={section}
                    editable={editable}
                    dragDisabled={savingOrder}
                    onDelete={onDelete}
                  />
                ))}
              </tbody>
            </SortableContext>
          </table>
        </DndContext>
      </div>
    </div>
  );
}
