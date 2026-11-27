import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  GitBranch,
  KanbanSquare,
  ListChecks,
  LogIn,
  LogOut,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import { auth, googleProvider } from './firebase/config';
import {
  batchUpdateStorySprints,
  deleteStoryDoc,
  deleteTeamScopeDoc,
  ensureWorkspaceSeeded,
  saveFeatureDoc,
  saveMemberDoc,
  saveSprintDoc,
  saveStoryDoc,
  saveTeamDoc,
  subscribeWorkspace,
} from './firebase/firestoreService';
import { applySprintScopeSelection, removeTeamFromWorkspace } from './lib/scrumMath';
import { SEED_WORKSPACE } from './data/seedData';
import { Feature, Member, Sprint, Story, Team, WorkspaceData } from './types/scrum';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { RefinementLifecycleView } from './components/RefinementLifecycleView';
import { CapacityTreeView } from './components/CapacityTreeView';
import { SprintPlanningBoard } from './components/SprintPlanningBoard';
import { StoryModal } from './components/StoryModal';
import { FeatureModal } from './components/FeatureModal';
import { MemberAllocationModal } from './components/MemberAllocationModal';
import { TeamModal } from './components/TeamModal';
import { SprintScopeModal } from './components/SprintScopeModal';
import { ErrorBoundary } from './components/ErrorBoundary';

type ActiveView = 'analytics' | 'refinement' | 'tree' | 'board';

const LOCAL_STORAGE_KEY = 'cadence_agile_workspace_v1';

function loadLocalWorkspace(): WorkspaceData {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as WorkspaceData;
      if (parsed && Array.isArray(parsed.teams) && Array.isArray(parsed.stories)) {
        return parsed;
      }
    }
  } catch {
    // Fallback to deterministic seed
  }
  return SEED_WORKSPACE;
}

const VIEW_LABELS: Record<ActiveView, { title: string; subtitle: string }> = {
  analytics: {
    title: 'Real-Time Analytics',
    subtitle: 'Squad capacity utilization, skill bottlenecks, and refinement velocity',
  },
  refinement: {
    title: 'Refinement Lifecycle',
    subtitle: 'Progress features and user stories from intake through Definition of Ready',
  },
  tree: {
    title: 'Capacity & Skill Tree',
    subtitle: 'Monitor multi-team user allocations, skills, and story assignments',
  },
  board: {
    title: 'Sprint Planning Board',
    subtitle: 'Drag and drop refined stories into capacity-balanced sprints',
  },
};

function WorkspaceShell() {
  const [activeView, setActiveView] = useState<ActiveView>('analytics');
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);

  const [workspace, setWorkspace] = useState<WorkspaceData>(loadLocalWorkspace);

  // Modal states
  const [storyModalOpen, setStoryModalOpen] = useState(false);
  const [editingStory, setEditingStory] = useState<Story | null>(null);
  const [defaultFeatureForStory, setDefaultFeatureForStory] = useState<string | undefined>(undefined);

  const [featureModalOpen, setFeatureModalOpen] = useState(false);
  const [editingFeature, setEditingFeature] = useState<Feature | null>(null);

  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);

  const [teamModalOpen, setTeamModalOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [teamDeleteInitialConfirm, setTeamDeleteInitialConfirm] = useState(false);

  const [sprintScopeModalOpen, setSprintScopeModalOpen] = useState(false);
  const [editingSprint, setEditingSprint] = useState<Sprint | null>(null);

  // Persist local sandbox state whenever user is not signed into Firebase
  useEffect(() => {
    if (!user) {
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(workspace));
      } catch {
        // Ignore storage quota errors
      }
    }
  }, [workspace, user]);

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // Subscribe to Firestore real-time workspace when authenticated
  useEffect(() => {
    if (!authReady || !user) return;
    let active = true;
    let unsubscribeFirestore: (() => void) | undefined;

    setIsSyncingCloud(true);
    setSyncError(null);

    ensureWorkspaceSeeded(user.uid, workspace)
      .then(() => {
        if (!active) return;
        unsubscribeFirestore = subscribeWorkspace(user.uid, {
          onTeams: (teams) => setWorkspace((prev) => ({ ...prev, teams })),
          onMembers: (members) => setWorkspace((prev) => ({ ...prev, members })),
          onFeatures: (features) => setWorkspace((prev) => ({ ...prev, features })),
          onSprints: (sprints) => setWorkspace((prev) => ({ ...prev, sprints })),
          onStories: (stories) => setWorkspace((prev) => ({ ...prev, stories })),
          onError: (err) => setSyncError(err.message),
        });
        setIsSyncingCloud(false);
      })
      .catch((err) => {
        if (!active) return;
        setSyncError(err instanceof Error ? err.message : String(err));
        setIsSyncingCloud(false);
      });

    return () => {
      active = false;
      if (unsubscribeFirestore) unsubscribeFirestore();
    };
  }, [authReady, user]);

  const handleSignIn = async () => {
    setSyncError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Google Sign-In failed.');
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
  };

  const handleResetDemo = () => {
    setWorkspace(SEED_WORKSPACE);
    setSelectedTeamId('');
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(SEED_WORKSPACE));
  };

  // Mutation handlers (sync to Firestore when signed in, or update local state seamlessly)
  const handleSaveStory = async (story: Story, isNew: boolean) => {
    setWorkspace((prev) => ({
      ...prev,
      stories: isNew
        ? [...prev.stories, story]
        : prev.stories.map((s) => (s.id === story.id ? story : s)),
    }));
    if (user) {
      await saveStoryDoc(user.uid, story, isNew);
    }
  };

  const handleDeleteStory = async (storyId: string) => {
    setWorkspace((prev) => ({
      ...prev,
      stories: prev.stories.filter((s) => s.id !== storyId),
    }));
    if (user) {
      await deleteStoryDoc(user.uid, storyId);
    }
  };

  const handleMoveStoryToSprint = async (storyId: string, targetSprintId: string) => {
    const existing = workspace.stories.find((s) => s.id === storyId);
    if (!existing || existing.sprintId === targetSprintId) return;
    const updated: Story = { ...existing, sprintId: targetSprintId };
    await handleSaveStory(updated, false);
  };

  const handleSaveFeature = async (feature: Feature, isNew: boolean) => {
    setWorkspace((prev) => ({
      ...prev,
      features: isNew
        ? [...prev.features, feature]
        : prev.features.map((f) => (f.id === feature.id ? feature : f)),
    }));
    if (user) {
      await saveFeatureDoc(user.uid, feature, isNew);
    }
  };

  const handleSaveMember = async (member: Member, isNew: boolean) => {
    setWorkspace((prev) => ({
      ...prev,
      members: isNew
        ? [...prev.members, member]
        : prev.members.map((m) => (m.id === member.id ? member : m)),
    }));
    if (user) {
      await saveMemberDoc(user.uid, member, isNew);
    }
  };

  const handleSaveTeam = async (team: Team, isNew: boolean) => {
    setWorkspace((prev) => ({
      ...prev,
      teams: isNew
        ? [...prev.teams, team]
        : prev.teams.map((t) => (t.id === team.id ? team : t)),
    }));
    if (user) {
      await saveTeamDoc(user.uid, team, isNew);
    }
  };

  const handleDeleteTeam = async (teamId: string, reassignToTeamId?: string) => {
    const { nextWorkspace, changes } = removeTeamFromWorkspace(
      workspace,
      teamId,
      reassignToTeamId
    );
    setWorkspace(nextWorkspace);
    if (selectedTeamId === teamId) {
      setSelectedTeamId('');
    }
    if (user) {
      await deleteTeamScopeDoc(user.uid, teamId, changes);
    }
  };

  const handleSaveSprintScope = async (
    sprint: Sprint,
    selectedStoryIds: string[],
    isNew: boolean
  ) => {
    const { updatedStories, changedStories } = applySprintScopeSelection(
      workspace.stories,
      sprint.id,
      selectedStoryIds
    );
    setWorkspace((prev) => ({
      ...prev,
      sprints: isNew
        ? [...prev.sprints, sprint]
        : prev.sprints.map((sp) => (sp.id === sprint.id ? sprint : sp)),
      stories: updatedStories,
    }));
    if (user) {
      await saveSprintDoc(user.uid, sprint, isNew);
      await batchUpdateStorySprints(user.uid, changedStories);
    }
  };

  const navItems: { id: ActiveView; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'refinement', label: 'Refinement', icon: ListChecks },
    { id: 'tree', label: 'Capacity Tree', icon: GitBranch },
    { id: 'board', label: 'Sprint Board', icon: KanbanSquare },
  ];

  const currentMeta = VIEW_LABELS[activeView];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col lg:flex-row">
      {/* Sidebar Navigation (240px on desktop) */}
      <aside className="lg:w-64 lg:shrink-0 bg-white border-b lg:border-b-0 lg:border-r border-slate-200 flex flex-col justify-between">
        <div>
          <div className="h-14 px-5 flex items-center border-b border-slate-200">
            <span className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap">
              Cadence
            </span>
          </div>

          <nav aria-label="Primary workspace navigation" className="p-3 flex lg:flex-col gap-1 overflow-x-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = activeView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveView(item.id)}
                  aria-current={active ? 'page' : undefined}
                  className={`flex items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Squad Scope Filter & Editor in Sidebar */}
          <div className="hidden lg:block px-4 py-3 border-t border-slate-100 space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-semibold text-slate-500">
                Squad Scope
              </span>
              <button
                type="button"
                onClick={() => {
                  setEditingTeam(null);
                  setTeamDeleteInitialConfirm(false);
                  setTeamModalOpen(true);
                }}
                aria-label="Add new squad"
                className="text-[11px] font-medium text-blue-600 hover:text-blue-700"
              >
                + Add
              </button>
            </div>
            <div className="space-y-0.5">
              <button
                type="button"
                onClick={() => setSelectedTeamId('')}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-md transition-colors ${
                  selectedTeamId === ''
                    ? 'bg-blue-50 text-blue-700 font-semibold'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span>All Squads</span>
                <span className="font-mono text-[11px]">{workspace.stories.length}</span>
              </button>
              {workspace.teams.map((t) => {
                const count = workspace.stories.filter((s) => s.teamId === t.id).length;
                const active = selectedTeamId === t.id;
                return (
                  <div key={t.id} className="flex items-center gap-0.5 group">
                    <button
                      type="button"
                      onClick={() => setSelectedTeamId(t.id)}
                      className={`flex-1 min-w-0 flex items-center justify-between px-2.5 py-1.5 text-xs rounded-md transition-colors ${
                        active
                          ? 'bg-blue-50 text-blue-700 font-semibold'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <span className="truncate">{t.name}</span>
                      <span className="font-mono text-[11px] shrink-0">{count}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingTeam(t);
                        setTeamDeleteInitialConfirm(false);
                        setTeamModalOpen(true);
                      }}
                      aria-label={`Edit squad scope for ${t.name}`}
                      className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors shrink-0"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingTeam(t);
                        setTeamDeleteInitialConfirm(true);
                        setTeamModalOpen(true);
                      }}
                      aria-label={`Delete squad scope for ${t.name}`}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors shrink-0"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Cloud Persistence / Account Footer */}
        <div className="hidden lg:block p-4 border-t border-slate-200 space-y-2.5">
          {user ? (
            <div className="space-y-2">
              <div className="text-xs font-medium text-slate-900 truncate">
                {user.displayName || user.email}
              </div>
              <div className="text-[11px] text-emerald-700 font-mono">
                {isSyncingCloud ? 'Syncing Firestore...' : 'Cloud Firestore Synced'}
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-[11px] text-slate-500 leading-snug">
                Changes saved locally. Sign in with Google to sync across devices.
              </div>
              <button
                type="button"
                onClick={handleSignIn}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                <LogIn className="w-3.5 h-3.5" />
                Sign In to Cloud Sync
              </button>
              <button
                type="button"
                onClick={handleResetDemo}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1 text-[11px] text-slate-500 hover:text-slate-800"
              >
                <RotateCcw className="w-3 h-3" />
                Reset Demo Data
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar Contract: Breadcrumb on left, concise squad filter on mobile, 1 primary CTA on right */}
        <header className="h-14 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-3 sm:gap-8 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="hidden sm:inline text-xs font-medium text-slate-400 whitespace-nowrap">
              {workspace.name}
            </span>
            <span className="hidden sm:inline text-slate-300" aria-hidden="true">/</span>
            <h1 className="text-sm font-semibold text-slate-900 truncate">
              {currentMeta.title}
            </h1>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <select
              aria-label="Filter workspace by squad"
              value={selectedTeamId}
              onChange={(e) => setSelectedTeamId(e.target.value)}
              className="lg:hidden px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-700"
            >
              <option value="">All Squads</option>
              {workspace.teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => {
                setEditingStory(null);
                setDefaultFeatureForStory(undefined);
                setStoryModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              New Story
            </button>
          </div>
        </header>

        <main className="flex-1 p-5 lg:p-6 max-w-[1440px] w-full mx-auto space-y-5">
          {syncError && (
            <div role="alert" className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
              Cloud sync notice: {syncError}
            </div>
          )}

          <div className="flex items-baseline justify-between gap-4">
            <p className="text-xs text-slate-500">{currentMeta.subtitle}</p>
            {selectedTeamId && (
              <button
                type="button"
                onClick={() => setSelectedTeamId('')}
                className="text-xs font-medium text-blue-600 hover:underline whitespace-nowrap shrink-0"
              >
                Clear Squad Filter
              </button>
            )}
          </div>

          {activeView === 'analytics' && (
            <AnalyticsDashboard
              teams={workspace.teams}
              members={workspace.members}
              features={workspace.features}
              sprints={workspace.sprints}
              stories={workspace.stories}
              selectedTeamId={selectedTeamId}
              onNavigateView={setActiveView}
              onInspectStory={(story) => {
                setEditingStory(story);
                setStoryModalOpen(true);
              }}
              onEditMember={(member) => {
                setEditingMember(member);
                setMemberModalOpen(true);
              }}
            />
          )}

          {activeView === 'refinement' && (
            <RefinementLifecycleView
              teams={workspace.teams}
              members={workspace.members}
              features={workspace.features}
              stories={workspace.stories}
              selectedTeamId={selectedTeamId}
              onCreateStory={(defaultFeatureId) => {
                setEditingStory(null);
                setDefaultFeatureForStory(defaultFeatureId);
                setStoryModalOpen(true);
              }}
              onEditStory={(story) => {
                setEditingStory(story);
                setStoryModalOpen(true);
              }}
              onCreateFeature={() => {
                setEditingFeature(null);
                setFeatureModalOpen(true);
              }}
              onEditFeature={(feature) => {
                setEditingFeature(feature);
                setFeatureModalOpen(true);
              }}
              onUpdateStory={(story) => handleSaveStory(story, false)}
            />
          )}

          {activeView === 'tree' && (
            <CapacityTreeView
              teams={workspace.teams}
              members={workspace.members}
              stories={workspace.stories}
              selectedTeamId={selectedTeamId}
              onEditMember={(member) => {
                setEditingMember(member);
                setMemberModalOpen(true);
              }}
              onCreateMember={() => {
                setEditingMember(null);
                setMemberModalOpen(true);
              }}
              onEditTeam={(team) => {
                setEditingTeam(team);
                setTeamDeleteInitialConfirm(false);
                setTeamModalOpen(true);
              }}
              onCreateTeam={() => {
                setEditingTeam(null);
                setTeamDeleteInitialConfirm(false);
                setTeamModalOpen(true);
              }}
              onEditStory={(story) => {
                setEditingStory(story);
                setStoryModalOpen(true);
              }}
            />
          )}

          {activeView === 'board' && (
            <SprintPlanningBoard
              teams={workspace.teams}
              members={workspace.members}
              features={workspace.features}
              sprints={workspace.sprints}
              stories={workspace.stories}
              selectedTeamId={selectedTeamId}
              onMoveStoryToSprint={handleMoveStoryToSprint}
              onEditStory={(story) => {
                setEditingStory(story);
                setStoryModalOpen(true);
              }}
              onCreateStory={() => {
                setEditingStory(null);
                setDefaultFeatureForStory(undefined);
                setStoryModalOpen(true);
              }}
              onEditSprint={(sprint) => {
                setEditingSprint(sprint);
                setSprintScopeModalOpen(true);
              }}
              onCreateSprint={() => {
                setEditingSprint(null);
                setSprintScopeModalOpen(true);
              }}
            />
          )}
        </main>
      </div>

      {/* Modals */}
      <StoryModal
        isOpen={storyModalOpen}
        story={editingStory}
        defaultFeatureId={defaultFeatureForStory}
        defaultTeamId={selectedTeamId || undefined}
        features={workspace.features}
        teams={workspace.teams}
        members={workspace.members}
        sprints={workspace.sprints}
        stories={workspace.stories}
        onClose={() => setStoryModalOpen(false)}
        onSave={handleSaveStory}
        onDelete={handleDeleteStory}
      />

      <FeatureModal
        isOpen={featureModalOpen}
        feature={editingFeature}
        teams={workspace.teams}
        onClose={() => setFeatureModalOpen(false)}
        onSave={handleSaveFeature}
      />

      <MemberAllocationModal
        isOpen={memberModalOpen}
        member={editingMember}
        teams={workspace.teams}
        onClose={() => setMemberModalOpen(false)}
        onSave={handleSaveMember}
      />

      <TeamModal
        isOpen={teamModalOpen}
        team={editingTeam}
        teams={workspace.teams}
        linkedCounts={
          editingTeam
            ? {
                stories: workspace.stories.filter((s) => s.teamId === editingTeam.id).length,
                features: workspace.features.filter((f) => f.teamId === editingTeam.id).length,
                members: workspace.members.filter((m) =>
                  m.teamAllocations.some((a) => a.teamId === editingTeam.id)
                ).length,
              }
            : { stories: 0, features: 0, members: 0 }
        }
        initialConfirmDelete={teamDeleteInitialConfirm}
        onClose={() => {
          setTeamModalOpen(false);
          setTeamDeleteInitialConfirm(false);
        }}
        onSave={handleSaveTeam}
        onDelete={handleDeleteTeam}
      />

      <SprintScopeModal
        isOpen={sprintScopeModalOpen}
        sprint={editingSprint}
        teams={workspace.teams}
        stories={workspace.stories}
        sprintsCount={workspace.sprints.length}
        selectedTeamId={selectedTeamId}
        onClose={() => setSprintScopeModalOpen(false)}
        onSaveScope={handleSaveSprintScope}
      />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <WorkspaceShell />
    </ErrorBoundary>
  );
}
