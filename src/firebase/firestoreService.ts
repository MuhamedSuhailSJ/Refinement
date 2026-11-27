import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  Unsubscribe,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { auth, db } from './config';
import { SEED_WORKSPACE } from '../data/seedData';
import { Feature, Member, Sprint, Story, Team, WorkspaceData } from '../types/scrum';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

function stripTimestamps<T extends Record<string, unknown>>(docData: T): Omit<T, 'ownerId' | 'createdAt' | 'updatedAt'> {
  const copy = { ...docData };
  delete copy.ownerId;
  delete copy.createdAt;
  delete copy.updatedAt;
  return copy as Omit<T, 'ownerId' | 'createdAt' | 'updatedAt'>;
}

export async function ensureWorkspaceSeeded(uid: string, initialData?: WorkspaceData): Promise<void> {
  const wsPath = `workspaces/${uid}`;
  try {
    const wsRef = doc(db, 'workspaces', uid);
    const snap = await getDoc(wsRef);
    if (snap.exists()) {
      const existingTeams = await getDocs(collection(db, `${wsPath}/teams`));
      if (!existingTeams.empty) {
        return;
      }
    }

    const seed = initialData ?? SEED_WORKSPACE;
    await setDoc(wsRef, {
      ownerId: uid,
      name: seed.name.slice(0, 120),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const batch = writeBatch(db);
    for (const team of seed.teams) {
      const ref = doc(db, `${wsPath}/teams`, team.id);
      batch.set(ref, {
        ownerId: uid,
        name: team.name.slice(0, 80),
        code: team.code.slice(0, 12),
        leadName: team.leadName.slice(0, 80),
        sprintCapacityPoints: team.sprintCapacityPoints,
        focusArea: team.focusArea.slice(0, 120),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    for (const member of seed.members) {
      const ref = doc(db, `${wsPath}/members`, member.id);
      batch.set(ref, {
        ownerId: uid,
        name: member.name.slice(0, 80),
        role: member.role.slice(0, 80),
        weeklyCapacityHours: member.weeklyCapacityHours,
        skills: member.skills.slice(0, 12),
        teamAllocations: member.teamAllocations.slice(0, 12),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    for (const feature of seed.features) {
      const ref = doc(db, `${wsPath}/features`, feature.id);
      batch.set(ref, {
        ownerId: uid,
        title: feature.title.slice(0, 140),
        description: feature.description.slice(0, 1000),
        priority: feature.priority,
        targetQuarter: feature.targetQuarter.slice(0, 24),
        teamId: feature.teamId,
        status: feature.status,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    for (const sprint of seed.sprints) {
      const ref = doc(db, `${wsPath}/sprints`, sprint.id);
      batch.set(ref, {
        ownerId: uid,
        name: sprint.name.slice(0, 80),
        goal: sprint.goal.slice(0, 300),
        startDate: sprint.startDate.slice(0, 24),
        endDate: sprint.endDate.slice(0, 24),
        status: sprint.status,
        order: sprint.order,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    for (const story of seed.stories) {
      const ref = doc(db, `${wsPath}/stories`, story.id);
      batch.set(ref, {
        ownerId: uid,
        title: story.title.slice(0, 160),
        description: story.description.slice(0, 1200),
        featureId: story.featureId,
        teamId: story.teamId,
        sprintId: story.sprintId,
        assigneeId: story.assigneeId,
        refinementStage: story.refinementStage,
        storyPoints: story.storyPoints,
        estimatedHours: story.estimatedHours,
        priority: story.priority,
        requiredSkills: story.requiredSkills.slice(0, 12),
        dorChecklist: story.dorChecklist,
        order: story.order,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, wsPath);
  }
}

export function subscribeWorkspace(
  uid: string,
  callbacks: {
    onTeams: (teams: Team[]) => void;
    onMembers: (members: Member[]) => void;
    onFeatures: (features: Feature[]) => void;
    onSprints: (sprints: Sprint[]) => void;
    onStories: (stories: Story[]) => void;
    onError: (err: Error) => void;
  }
): () => void {
  const unsubs: Unsubscribe[] = [];
  const base = `workspaces/${uid}`;

  const wrapSnapshotError = (path: string) => (err: unknown) => {
    try {
      handleFirestoreError(err, OperationType.LIST, path);
    } catch (wrapped) {
      callbacks.onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
    }
  };

  unsubs.push(
    onSnapshot(
      collection(db, `${base}/teams`),
      (snap) => {
        const items = snap.docs.map((d) => ({ id: d.id, ...stripTimestamps(d.data()) }) as Team);
        callbacks.onTeams(items);
      },
      wrapSnapshotError(`${base}/teams`)
    )
  );

  unsubs.push(
    onSnapshot(
      collection(db, `${base}/members`),
      (snap) => {
        const items = snap.docs.map((d) => ({ id: d.id, ...stripTimestamps(d.data()) }) as Member);
        callbacks.onMembers(items);
      },
      wrapSnapshotError(`${base}/members`)
    )
  );

  unsubs.push(
    onSnapshot(
      collection(db, `${base}/features`),
      (snap) => {
        const items = snap.docs.map((d) => ({ id: d.id, ...stripTimestamps(d.data()) }) as Feature);
        callbacks.onFeatures(items);
      },
      wrapSnapshotError(`${base}/features`)
    )
  );

  unsubs.push(
    onSnapshot(
      collection(db, `${base}/sprints`),
      (snap) => {
        const items = snap.docs
          .map((d) => ({ id: d.id, ...stripTimestamps(d.data()) }) as Sprint)
          .sort((a, b) => a.order - b.order);
        callbacks.onSprints(items);
      },
      wrapSnapshotError(`${base}/sprints`)
    )
  );

  unsubs.push(
    onSnapshot(
      collection(db, `${base}/stories`),
      (snap) => {
        const items = snap.docs
          .map((d) => ({ id: d.id, ...stripTimestamps(d.data()) }) as Story)
          .sort((a, b) => a.order - b.order);
        callbacks.onStories(items);
      },
      wrapSnapshotError(`${base}/stories`)
    )
  );

  return () => {
    unsubs.forEach((fn) => fn());
  };
}

export async function saveTeamDoc(uid: string, team: Team, isNew: boolean): Promise<void> {
  const path = `workspaces/${uid}/teams/${team.id}`;
  try {
    const ref = doc(db, `workspaces/${uid}/teams`, team.id);
    if (isNew) {
      await setDoc(ref, {
        ownerId: uid,
        name: team.name.slice(0, 80),
        code: team.code.slice(0, 12),
        leadName: team.leadName.slice(0, 80),
        sprintCapacityPoints: team.sprintCapacityPoints,
        focusArea: team.focusArea.slice(0, 120),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        name: team.name.slice(0, 80),
        code: team.code.slice(0, 12),
        leadName: team.leadName.slice(0, 80),
        sprintCapacityPoints: team.sprintCapacityPoints,
        focusArea: team.focusArea.slice(0, 120),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function saveMemberDoc(uid: string, member: Member, isNew: boolean): Promise<void> {
  const path = `workspaces/${uid}/members/${member.id}`;
  try {
    const ref = doc(db, `workspaces/${uid}/members`, member.id);
    if (isNew) {
      await setDoc(ref, {
        ownerId: uid,
        name: member.name.slice(0, 80),
        role: member.role.slice(0, 80),
        weeklyCapacityHours: member.weeklyCapacityHours,
        skills: member.skills.slice(0, 12),
        teamAllocations: member.teamAllocations.slice(0, 12),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        name: member.name.slice(0, 80),
        role: member.role.slice(0, 80),
        weeklyCapacityHours: member.weeklyCapacityHours,
        skills: member.skills.slice(0, 12),
        teamAllocations: member.teamAllocations.slice(0, 12),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function saveFeatureDoc(uid: string, feature: Feature, isNew: boolean): Promise<void> {
  const path = `workspaces/${uid}/features/${feature.id}`;
  try {
    const ref = doc(db, `workspaces/${uid}/features`, feature.id);
    if (isNew) {
      await setDoc(ref, {
        ownerId: uid,
        title: feature.title.slice(0, 140),
        description: feature.description.slice(0, 1000),
        priority: feature.priority,
        targetQuarter: feature.targetQuarter.slice(0, 24),
        teamId: feature.teamId,
        status: feature.status,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        title: feature.title.slice(0, 140),
        description: feature.description.slice(0, 1000),
        priority: feature.priority,
        targetQuarter: feature.targetQuarter.slice(0, 24),
        teamId: feature.teamId,
        status: feature.status,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function saveStoryDoc(uid: string, story: Story, isNew: boolean): Promise<void> {
  const path = `workspaces/${uid}/stories/${story.id}`;
  try {
    const ref = doc(db, `workspaces/${uid}/stories`, story.id);
    if (isNew) {
      await setDoc(ref, {
        ownerId: uid,
        title: story.title.slice(0, 160),
        description: story.description.slice(0, 1200),
        featureId: story.featureId,
        teamId: story.teamId,
        sprintId: story.sprintId,
        assigneeId: story.assigneeId,
        refinementStage: story.refinementStage,
        storyPoints: story.storyPoints,
        estimatedHours: story.estimatedHours,
        priority: story.priority,
        requiredSkills: story.requiredSkills.slice(0, 12),
        dorChecklist: story.dorChecklist,
        order: story.order,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        title: story.title.slice(0, 160),
        description: story.description.slice(0, 1200),
        featureId: story.featureId,
        teamId: story.teamId,
        sprintId: story.sprintId,
        assigneeId: story.assigneeId,
        refinementStage: story.refinementStage,
        storyPoints: story.storyPoints,
        estimatedHours: story.estimatedHours,
        priority: story.priority,
        requiredSkills: story.requiredSkills.slice(0, 12),
        dorChecklist: story.dorChecklist,
        order: story.order,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function deleteStoryDoc(uid: string, storyId: string): Promise<void> {
  const path = `workspaces/${uid}/stories/${storyId}`;
  try {
    await deleteDoc(doc(db, `workspaces/${uid}/stories`, storyId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveSprintDoc(uid: string, sprint: Sprint, isNew: boolean): Promise<void> {
  const path = `workspaces/${uid}/sprints/${sprint.id}`;
  try {
    const ref = doc(db, `workspaces/${uid}/sprints`, sprint.id);
    if (isNew) {
      await setDoc(ref, {
        ownerId: uid,
        name: sprint.name.slice(0, 80),
        goal: sprint.goal.slice(0, 300),
        startDate: sprint.startDate.slice(0, 24),
        endDate: sprint.endDate.slice(0, 24),
        status: sprint.status,
        order: sprint.order,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        name: sprint.name.slice(0, 80),
        goal: sprint.goal.slice(0, 300),
        startDate: sprint.startDate.slice(0, 24),
        endDate: sprint.endDate.slice(0, 24),
        status: sprint.status,
        order: sprint.order,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function batchUpdateStorySprints(
  uid: string,
  changedStories: Story[]
): Promise<void> {
  if (changedStories.length === 0) return;
  const path = `workspaces/${uid}/stories`;
  try {
    const batch = writeBatch(db);
    for (const st of changedStories) {
      const ref = doc(db, `workspaces/${uid}/stories`, st.id);
      batch.update(ref, {
        sprintId: st.sprintId,
        order: st.order,
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteTeamScopeDoc(
  uid: string,
  teamId: string,
  changes: {
    updatedMembers: Member[];
    reassignedFeatures: Feature[];
    deletedFeatureIds: string[];
    reassignedStories: Story[];
    deletedStoryIds: string[];
  }
): Promise<void> {
  const path = `workspaces/${uid}/teams/${teamId}`;
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, `workspaces/${uid}/teams`, teamId));

    for (const member of changes.updatedMembers) {
      batch.update(doc(db, `workspaces/${uid}/members`, member.id), {
        teamAllocations: member.teamAllocations.slice(0, 12),
        updatedAt: serverTimestamp(),
      });
    }

    for (const feature of changes.reassignedFeatures) {
      batch.update(doc(db, `workspaces/${uid}/features`, feature.id), {
        teamId: feature.teamId,
        updatedAt: serverTimestamp(),
      });
    }

    for (const featureId of changes.deletedFeatureIds) {
      batch.delete(doc(db, `workspaces/${uid}/features`, featureId));
    }

    for (const story of changes.reassignedStories) {
      batch.update(doc(db, `workspaces/${uid}/stories`, story.id), {
        teamId: story.teamId,
        updatedAt: serverTimestamp(),
      });
    }

    for (const storyId of changes.deletedStoryIds) {
      batch.delete(doc(db, `workspaces/${uid}/stories`, storyId));
    }

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}


