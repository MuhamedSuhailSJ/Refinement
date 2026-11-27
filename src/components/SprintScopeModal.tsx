import React, { useEffect, useMemo, useState } from 'react';
import { X, CheckSquare, Square, AlertTriangle, Search } from 'lucide-react';
import { Sprint, SprintStatus, Story, Team } from '../types/scrum';
import { calculateSprintScopePreview } from '../lib/scrumMath';

interface SprintScopeModalProps {
  isOpen: boolean;
  sprint: Sprint | null; // null means creating a new sprint
  teams: Team[];
  stories: Story[];
  sprintsCount: number;
  selectedTeamId: string;
  onClose: () => void;
  onSaveScope: (
    sprint: Sprint,
    selectedStoryIds: string[],
    isNew: boolean
  ) => void;
}

export const SprintScopeModal: React.FC<SprintScopeModalProps> = ({
  isOpen,
  sprint,
  teams,
  stories,
  sprintsCount,
  selectedTeamId,
  onClose,
  onSaveScope,
}) => {
  const isNew = !sprint;
  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');
  const [startDate, setStartDate] = useState('2026-12-28');
  const [endDate, setEndDate] = useState('2027-01-10');
  const [status, setStatus] = useState<SprintStatus>('Planned');
  const [selectedStoryIds, setSelectedStoryIds] = useState<string[]>([]);
  const [storySearch, setStorySearch] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setStorySearch('');
    if (sprint) {
      setName(sprint.name);
      setGoal(sprint.goal);
      setStartDate(sprint.startDate);
      setEndDate(sprint.endDate);
      setStatus(sprint.status);
      setSelectedStoryIds(
        stories.filter((s) => s.sprintId === sprint.id).map((s) => s.id)
      );
    } else {
      setName(`Sprint ${24 + sprintsCount}`);
      setGoal('');
      setStartDate('2026-12-28');
      setEndDate('2027-01-10');
      setStatus('Horizon');
      setSelectedStoryIds([]);
    }
  }, [isOpen, sprint, stories, sprintsCount]);

  const teamMap = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);

  const targetSprintId = sprint?.id ?? '__new_sprint__';
  const preview = useMemo(
    () =>
      calculateSprintScopePreview(
        stories,
        teams,
        targetSprintId,
        selectedStoryIds,
        selectedTeamId || undefined
      ),
    [stories, teams, targetSprintId, selectedStoryIds, selectedTeamId]
  );

  if (!isOpen) return null;

  const toggleStory = (storyId: string) => {
    setSelectedStoryIds((prev) =>
      prev.includes(storyId) ? prev.filter((id) => id !== storyId) : [...prev, storyId]
    );
  };

  const visibleStories = stories.filter((s) => {
    if (selectedTeamId && s.teamId !== selectedTeamId) return false;
    if (
      storySearch.trim() &&
      !s.title.toLowerCase().includes(storySearch.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const savedSprint: Sprint = {
      id: sprint?.id ?? `sprint-${Date.now().toString(36)}`,
      name: name.trim(),
      goal: goal.trim(),
      startDate: startDate.trim() || '2026-12-28',
      endDate: endDate.trim() || '2027-01-10',
      status,
      order: sprint?.order ?? sprintsCount + 1,
    };
    onSaveScope(savedSprint, selectedStoryIds, isNew);
    onClose();
  };

  const isOver = preview.utilizationPercent > 100;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-[1px] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sprint-scope-modal-title"
    >
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 id="sprint-scope-modal-title" className="text-base font-semibold text-slate-900">
              {isNew ? 'Create Sprint & Define Scope' : `Edit Scope · ${sprint.name}`}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Adjust sprint goal, dates, and bulk-assign or remove stories from sprint scope
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close sprint scope dialog"
            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto px-6 py-5 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <label htmlFor="sp-name" className="block text-xs font-medium text-slate-700">
                Sprint Name *
              </label>
              <input
                id="sp-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="sp-status" className="block text-xs font-medium text-slate-700">
                Status
              </label>
              <select
                id="sp-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as SprintStatus)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="Active">Active</option>
                <option value="Planned">Planned</option>
                <option value="Horizon">Horizon</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <span className="block text-xs font-medium text-slate-700">Scope Preview</span>
              <div className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs font-mono text-slate-900">
                {preview.committedPoints}/{preview.targetPoints} pts
                {preview.deltaPoints !== 0 && (
                  <span
                    className={`ml-1.5 ${
                      preview.deltaPoints > 0 ? 'text-blue-700' : 'text-amber-700'
                    }`}
                  >
                    ({preview.deltaPoints > 0 ? `+${preview.deltaPoints}` : preview.deltaPoints})
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="sp-start" className="block text-xs font-medium text-slate-700">
                Start Date
              </label>
              <input
                id="sp-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="sp-end" className="block text-xs font-medium text-slate-700">
                End Date
              </label>
              <input
                id="sp-end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="sp-goal" className="block text-xs font-medium text-slate-700">
              Sprint Goal &amp; Scope Objective
            </label>
            <textarea
              id="sp-goal"
              rows={2}
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="Define the delivery commitment and acceptance objective for this sprint..."
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          {/* Live Capacity Preview Bar */}
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-700">
                Committed Scope ({preview.storyCount} stories · {preview.committedHours}h)
              </span>
              <span
                className={`font-mono font-semibold ${
                  isOver
                    ? 'text-red-700'
                    : preview.utilizationPercent >= 85
                    ? 'text-amber-700'
                    : 'text-emerald-700'
                }`}
              >
                {preview.utilizationPercent}% capacity
              </span>
            </div>
            <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-200 ${
                  isOver
                    ? 'bg-red-600'
                    : preview.utilizationPercent >= 85
                    ? 'bg-amber-500'
                    : 'bg-blue-600'
                }`}
                style={{ width: `${Math.min(100, preview.utilizationPercent)}%` }}
              />
            </div>
            {isOver && (
              <div className="flex items-center gap-1.5 text-[11px] text-red-700 font-medium">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>Scope exceeds squad sprint capacity target by {preview.committedPoints - preview.targetPoints} pts.</span>
              </div>
            )}
          </div>

          {/* Story Scope Picker */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold text-slate-900">
                Stories Included in Scope
              </span>
              <div className="relative w-56">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  aria-label="Filter stories in sprint scope"
                  value={storySearch}
                  onChange={(e) => setStorySearch(e.target.value)}
                  placeholder="Filter stories..."
                  className="w-full pl-8 pr-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:bg-white focus:ring-1 focus:ring-blue-600"
                />
              </div>
            </div>

            <div className="max-h-56 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
              {visibleStories.map((st) => {
                const checked = selectedStoryIds.includes(st.id);
                const team = teamMap.get(st.teamId);
                const inOtherSprint = st.sprintId !== '' && st.sprintId !== sprint?.id;

                return (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => toggleStory(st.id)}
                    aria-pressed={checked}
                    className={`w-full px-3 py-2 text-left flex items-center justify-between gap-3 transition-colors ${
                      checked ? 'bg-blue-50/50 hover:bg-blue-50' : 'bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {checked ? (
                        <CheckSquare className="w-4 h-4 text-blue-600 shrink-0" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-300 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-slate-900 truncate">
                          {st.title}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          {team?.code ?? 'TEAM'} · {st.refinementStage}
                          {inOtherSprint ? ' · Currently in another sprint' : ''}
                        </div>
                      </div>
                    </div>
                    <span className="text-xs font-mono font-semibold text-slate-700 shrink-0">
                      {st.storyPoints}p / {st.estimatedHours}h
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Save Sprint Scope
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
