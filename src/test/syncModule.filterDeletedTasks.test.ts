import { describe, it, expect } from 'vitest';

/**
 * These tests verify that tasks present in the TickTick API's `delete` array
 * are excluded from the `update` array before "new task" detection runs.
 *
 * Bug: When a task is deleted from TickTick, the API can return it in both
 * `syncTaskBean.update` and `syncTaskBean.delete`. Without filtering, the
 * deleted task is treated as "new" and silently appended to a random note.
 *
 * Since SyncMan imports 'obsidian', we test the filtering logic directly.
 */

interface MockTask { id: string; tags?: string[]; title: string }
interface MockDeletedTask { taskId: string; projectId: string }

/** Mirrors the filter added in syncTickTickToObsidian */
function filterDeletedFromUpdate(update: MockTask[], deleted: MockDeletedTask[] | undefined): MockTask[] {
	return update.filter(task => !deleted?.some(d => d.taskId === task.id));
}

/** Mirrors the "new tasks" detection logic */
function findNewTasks(remoteFiltered: MockTask[], cache: MockTask[]): MockTask[] {
	return remoteFiltered.filter(task => !cache.some(t => t.id === task.id));
}

describe('Ghost task filtering: deleted tasks must not appear as new', () => {
	const taskA: MockTask = { id: 'aaaaaaaaaaaaaaaaaaaaaaaa', tags: ['ticktick'], title: 'Task A' };
	const taskB: MockTask = { id: 'bbbbbbbbbbbbbbbbbbbbbbbb', tags: ['ticktick'], title: 'Task B' };
	const taskC: MockTask = { id: 'cccccccccccccccccccccccc', tags: ['ticktick'], title: 'Task C' };

	it('should exclude tasks present in both update and delete arrays', () => {
		const update = [taskA, taskB, taskC];
		const deleted: MockDeletedTask[] = [
			{ taskId: 'bbbbbbbbbbbbbbbbbbbbbbbb', projectId: 'proj1' },
		];
		const cache = [taskA]; // taskA already in cache

		const filtered = filterDeletedFromUpdate(update, deleted);
		const newTasks = findNewTasks(filtered, cache);

		// taskB was deleted — must NOT appear as new
		expect(newTasks.map(t => t.id)).not.toContain('bbbbbbbbbbbbbbbbbbbbbbbb');
		// taskC is genuinely new
		expect(newTasks.map(t => t.id)).toEqual(['cccccccccccccccccccccccc']);
	});

	it('should handle undefined delete array gracefully', () => {
		const update = [taskA, taskB];
		const cache: MockTask[] = [];

		const filtered = filterDeletedFromUpdate(update, undefined);
		const newTasks = findNewTasks(filtered, cache);

		expect(newTasks).toHaveLength(2);
	});

	it('should handle empty delete array', () => {
		const update = [taskA];
		const cache: MockTask[] = [];

		const filtered = filterDeletedFromUpdate(update, []);
		expect(filtered).toEqual([taskA]);
	});

	it('should remove all tasks if all are deleted', () => {
		const update = [taskA, taskB];
		const deleted: MockDeletedTask[] = [
			{ taskId: 'aaaaaaaaaaaaaaaaaaaaaaaa', projectId: 'proj1' },
			{ taskId: 'bbbbbbbbbbbbbbbbbbbbbbbb', projectId: 'proj2' },
		];

		const filtered = filterDeletedFromUpdate(update, deleted);
		expect(filtered).toHaveLength(0);
	});

	it('should not affect tasks only in cache (not in update)', () => {
		const update = [taskA];
		const deleted: MockDeletedTask[] = [
			{ taskId: 'bbbbbbbbbbbbbbbbbbbbbbbb', projectId: 'proj1' },
		];
		const cache = [taskA, taskB];

		const filtered = filterDeletedFromUpdate(update, deleted);
		// taskB is in cache but not in update — filtering update doesn't touch it
		expect(filtered).toEqual([taskA]);
	});
});
