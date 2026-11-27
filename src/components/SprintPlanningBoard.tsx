import React, { useState } from 'react';
import { GripVertical, AlertTriangle, Plus, SlidersHorizontal } from 'lucide-react';
import { Feature, Member, Sprint, Story, Team } from '../types/scrum';
import { calculateSprintCapacityMetrics } from '../lib/scrumMath';

interface SprintPlanningBoardProps {
  teams: Team[];
  members: Member[];
  features: Feature[];
  sprints: Sprint[];
  stories: Story[];
  selectedTeamId: string;
  onMoveStoryToSprint: (storyId: string, targetSprintId: string) => void;
  onEditStory: (story: Story) => void;
  onCreateStory: () => void;
  onEditSprint: (sprint: Sprint) => void;
  onCreateSprint: () => void;
}

export const SprintPlanningBoard: React.FC<SprintPlanningBoardProps> = ({
  teams,
  members,
  features,
  sprints,
  stories,
  selectedTeamId,
  onMoveStoryToSprint,
  onEditStory,
  onCreateStory,
  onEditSprint,
  onCreateSprint,
}) => {
  const [draggedStoryId, setDraggedStoryId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [onlyReadyInBacklog, setOnlyReadyInBacklog] = useState(false);

  const teamMap = new Map(teams.map((t) => [t.id, t]));
  const memberMap = new Map(members.map((m) => [m.id, m]));
  const featureMap = new Map(features.map((f) => [f.id, f]));

  const visibleStories = stories.filter(
    (s) => !selectedTeamId || s.teamId === selectedTeamId
  );

  const backlogStories = visibleStories.filter(
    (s) =>
      s.sprintId === '' &&
      (!onlyReadyInBacklog || s.refinementStage === 'Ready for Sprint')
  );

  const handleDragStart = (e: React.DragEvent, storyId: string) => {
    setDraggedStoryId(storyId);
    e.dataTransfer.setData('text/plain', storyId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverColumn !== columnId) {
      setDragOverColumn(columnId);
    }
  };

  const handleDrop = (e: React.DragEvent, targetSprintId: string) => {
    e.preventDefault();
    const storyId = e.dataTransfer.getData('text/plain') || draggedStoryId;
    setDraggedStoryId(null);
    setDragOverColumn(null);
    if (storyId) {
      onMoveStoryToSprint(storyId, targetSprintId);
    }
  };

  const renderStoryCard = (story: Story) => {
    const team = teamMap.get(story.teamId);
    const assignee = story.assigneeId ? memberMap.get(story.assigneeId) : null;
    const feature = featureMap.get(story.featureId);
    const isReady = story.refinementStage === 'Ready for Sprint';

    return (
      <div
        key={story.id}
        draggable
        onDragStart={(e) => handleDragStart(e, story.id)}
        onDragEnd={() => {
          setDraggedStoryId(null);
          setDragOverColumn(null);
        }}
        data-testid={`board-story-${story.id}`}
        className={`p-3 rounded-lg border bg-white transition-colors cursor-grab active:cursor-grabbing space-y-2 ${
          draggedStoryId === story.id
            ? 'opacity-50 border-blue-400'
            : 'border-slate-200 hover:border-slate-300'
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-1.5 min-w-0">
            <GripVertical className="w-3.5 h-3.5 text-slate-300 shrink-0 mt-0.5" aria-hidden="true" />
            <button
              type="button"
              onClick={() => onEditStory(story)}
              className="text-left text-xs font-semibold text-slate-900 hover:text-blue-600 leading-snug"
            >
              {story.title}
            </button>
          </div>
          <span className="font-mono text-[11px] font-semibold text-slate-800 shrink-0">
            {story.storyPoints}p
          </span>
        </div>

        <div className="text-[11px] text-slate-500 truncate pl-5">
          {feature?.title ?? 'Feature'} · {team?.code ?? 'TEAM'}
        </div>

        <div className="pl-5 space-y-1 text-[11px]">
          <div className="flex items-center justify-between gap-2">
            <span
              className={`font-medium whitespace-nowrap ${
                isReady ? 'text-emerald-700' : 'text-amber-700'
              }`}
            >
              {story.refinementStage}
            </span>
            <span className="font-mono text-slate-600 whitespace-nowrap shrink-0">
              {story.estimatedHours}h
            </span>
          </div>
          <div className="font-mono text-slate-500 truncate">
            {story.requiredSkills.join(', ')}
          </div>
        </div>

        <div className="pl-5 pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
          <span className="text-[11px] text-slate-600 truncate">
            {assignee ? assignee.name : 'Unassigned'}
          </span>
          <select
            aria-label={`Move '${story.title}' to sprint`}
            value={story.sprintId}
            onChange={(e) => onMoveStoryToSprint(story.id, e.target.value)}
            className="px-2 py-1 text-[11px] bg-slate-50 border border-slate-200 rounded text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-600 shrink-0"
          >
            <option value="">Backlog</option>
            {sprints.map((sp) => (
              <option key={sp.id} value={sp.id}>
                {sp.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-slate-900">
            Drag-and-Drop Sprint Planning Board
          </h2>
          <span className="text-xs text-slate-500">
            Drag stories between Backlog and Sprints, or use the sprint selector on any card
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            aria-pressed={onlyReadyInBacklog}
            onClick={() => setOnlyReadyInBacklog((v) => !v)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
              onlyReadyInBacklog
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
            }`}
          >
            Ready Stories Only
          </button>
          <button
            type="button"
            onClick={onCreateSprint}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            New Sprint
          </button>
        </div>
      </div>

      {/* Horizontal Planning Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
        {/* Backlog Column */}
        <section
          aria-label="Refinement Backlog column"
          data-testid="board-col-backlog"
          onDragOver={(e) => handleDragOver(e, 'backlog')}
          onDragLeave={() => setDragOverColumn(null)}
          onDrop={(e) => handleDrop(e, '')}
          className={`rounded-xl border flex flex-col transition-colors ${
            dragOverColumn === 'backlog'
              ? 'border-blue-500 bg-blue-50/40'
              : 'border-slate-200 bg-slate-100/70'
          }`}
        >
          <div className="px-4 py-3 border-b border-slate-200 bg-white rounded-t-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-slate-900">Refinement Backlog</h3>
              <span className="text-xs font-mono text-slate-500">
                {backlogStories.length} items
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Unscheduled stories ready or refining
            </p>
          </div>

          <div className="p-3 space-y-2.5 min-h-[360px]">
            {backlogStories.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                Drop stories here to unschedule
              </div>
            ) : (
              backlogStories.map(renderStoryCard)
            )}
          </div>
        </section>

        {/* Sprint Columns */}
        {sprints.map((sprint) => {
          const sprintStories = visibleStories.filter((s) => s.sprintId === sprint.id);
          const metrics = calculateSprintCapacityMetrics(
            sprint,
            teams,
            stories,
            selectedTeamId || undefined
          );
          const isOver = metrics.utilizationPercent > 100;

          return (
            <section
              key={sprint.id}
              aria-label={`${sprint.name} planning column`}
              data-testid={`board-col-${sprint.id}`}
              onDragOver={(e) => handleDragOver(e, sprint.id)}
              onDragLeave={() => setDragOverColumn(null)}
              onDrop={(e) => handleDrop(e, sprint.id)}
              className={`rounded-xl border flex flex-col transition-colors ${
                dragOverColumn === sprint.id
                  ? 'border-blue-500 bg-blue-50/40'
                  : 'border-slate-200 bg-slate-100/70'
              }`}
            >
              <div className="px-4 py-3 border-b border-slate-200 bg-white rounded-t-xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-semibold text-slate-900">{sprint.name}</h3>
                    <span className="text-[11px] font-mono text-slate-500">{sprint.status}</span>
                  </div>
                  <span
                    className={`text-xs font-mono font-semibold ${
                      isOver
                        ? 'text-red-700'
                        : metrics.utilizationPercent >= 85
                        ? 'text-amber-700'
                        : 'text-slate-700'
                    }`}
                  >
                    {metrics.committedPoints}/{metrics.targetPoints} pts ({metrics.utilizationPercent}%)
                  </span>
                </div>

                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-200 ${
                      isOver
                        ? 'bg-red-600'
                        : metrics.utilizationPercent >= 85
                        ? 'bg-amber-500'
                        : 'bg-blue-600'
                    }`}
                    style={{ width: `${Math.min(100, metrics.utilizationPercent)}%` }}
                  />
                </div>

                <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
                  <span className="truncate">{sprint.startDate} → {sprint.endDate}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    {isOver && (
                      <span className="inline-flex items-center gap-1 text-red-700 font-medium">
                        <AlertTriangle className="w-3 h-3" />
                        Over Capacity
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => onEditSprint(sprint)}
                      aria-label={`Edit scope for ${sprint.name}`}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-700 hover:underline whitespace-nowrap"
                    >
                      <SlidersHorizontal className="w-3 h-3" />
                      Edit Scope
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-3 space-y-2.5 min-h-[360px]">
                {sprintStories.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-400">
                    Drag stories into {sprint.name}
                  </div>
                ) : (
                  sprintStories.map(renderStoryCard)
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
};
