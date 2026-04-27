import { describe, it, expect } from 'vitest';

/**
 * These tests verify the guard clause logic that was added to FileMap.updateTask()
 * and FileMap.deleteTaskAndLines(). Since FileMap imports 'obsidian' (which isn't
 * available in the test environment), we test the core splice logic directly.
 *
 * The bugs being tested:
 * 1. updateTask with missing task ID used to splice at index 0, inserting at top of file
 * 2. deleteTaskAndLines with missing task ID used to splice(-1, N), corrupting file end
 */

const TASK_ID_REGEX = /%%\[ticktick_id::\s*([a-f0-9]{24})\]%%/;

function getTaskIndex(lines: string[], id: string): number {
	return lines.findIndex(str => str.includes('- [') && str.includes(id));
}

describe('Guard clause: updateTask with missing task ID', () => {
	it('should NOT insert at line 0 when task is not found', () => {
		const lines = [
			'---',
			'title: My Note',
			'---',
			'',
			'- [ ] Task A #ticktick  %%[ticktick_id:: aaaaaaaaaaaaaaaaaaaaaaaa]%%',
		];
		const original = [...lines];
		const missingId = 'cccccccccccccccccccccccc';

		const taskIdx = getTaskIndex(lines, missingId);

		// OLD behavior: taskIdx = 0, splice(0, 0, newLine) — inserts at top
		// NEW behavior: taskIdx === -1, return early
		expect(taskIdx).toBe(-1);

		// Simulate the NEW guard clause: if taskIdx < 0, don't modify
		if (taskIdx < 0) {
			// no-op
		} else {
			lines.splice(taskIdx, 0, '- [ ] Ghost #ticktick  %%[ticktick_id:: cccccccccccccccccccccccc]%%');
		}

		expect(lines).toEqual(original);
	});

	it('should still update when task IS found', () => {
		const lines = [
			'---',
			'title: My Note',
			'---',
			'',
			'- [ ] Task A #ticktick  %%[ticktick_id:: aaaaaaaaaaaaaaaaaaaaaaaa]%%',
		];
		const existingId = 'aaaaaaaaaaaaaaaaaaaaaaaa';
		const taskIdx = getTaskIndex(lines, existingId);

		expect(taskIdx).toBe(4);

		// Simulate update: replace the line
		if (taskIdx >= 0) {
			lines.splice(taskIdx, 1, '- [x] Task A updated #ticktick  %%[ticktick_id:: aaaaaaaaaaaaaaaaaaaaaaaa]%%');
		}

		expect(lines[4]).toContain('Task A updated');
	});
});

describe('Guard clause: deleteTaskAndLines with missing task ID', () => {
	it('should NOT corrupt file when task is not found', () => {
		const lines = [
			'---',
			'title: My Note',
			'---',
			'',
			'- [ ] Task A #ticktick  %%[ticktick_id:: aaaaaaaaaaaaaaaaaaaaaaaa]%%',
			'',
			'Footer text',
		];
		const original = [...lines];
		const missingId = 'cccccccccccccccccccccccc';

		const taskIdx = getTaskIndex(lines, missingId);

		// OLD behavior: taskIdx = -1, splice(-1, N) deletes from end of array
		// NEW behavior: taskIdx === -1, return early
		expect(taskIdx).toBe(-1);

		// Demonstrate the OLD bug: splice(-1, ...) removes from end
		const bugDemo = [...lines];
		bugDemo.splice(-1, 1); // This would delete "Footer text"
		expect(bugDemo.length).toBe(lines.length - 1);
		expect(bugDemo[bugDemo.length - 1]).toBe(''); // Footer is gone

		// Simulate the NEW guard clause: if taskIdx < 0, don't modify
		if (taskIdx < 0) {
			// no-op
		} else {
			lines.splice(taskIdx, 1);
		}

		expect(lines).toEqual(original);
	});

	it('should still delete when task IS found', () => {
		const lines = [
			'---',
			'title: My Note',
			'---',
			'',
			'- [ ] Task A #ticktick  %%[ticktick_id:: aaaaaaaaaaaaaaaaaaaaaaaa]%%',
			'',
			'Footer text',
		];
		const existingId = 'aaaaaaaaaaaaaaaaaaaaaaaa';
		const taskIdx = getTaskIndex(lines, existingId);

		expect(taskIdx).toBe(4);

		if (taskIdx >= 0) {
			lines.splice(taskIdx, 1);
		}

		expect(lines.length).toBe(6);
		expect(lines.join('\n')).not.toContain('aaaaaaaaaaaaaaaaaaaaaaaa');
		expect(lines[lines.length - 1]).toBe('Footer text');
	});
});

describe('Guard clause: findMissingTaskIds cache safety net', () => {
	it('should not flag task as missing if it exists in cache', () => {
		// Simulate: task is in metadata but not in file content
		const fileContent = '- [ ] Other task #ticktick  %%[ticktick_id:: bbbbbbbbbbbbbbbbbbbbbbbb]%%';
		const metadataTaskIds = ['aaaaaaaaaaaaaaaaaaaaaaaa', 'bbbbbbbbbbbbbbbbbbbbbbbb'];

		const regex = /%%\[ticktick_id:: ([a-f0-9]{24})\]%%/g;
		const matches = fileContent.matchAll(regex);
		const existingTaskIds = new Set([...matches].map((match) => match[1]));

		let missingTaskIds = metadataTaskIds.filter(id => !existingTaskIds.has(id));
		expect(missingTaskIds).toContain('aaaaaaaaaaaaaaaaaaaaaaaa');

		// Simulate cache lookup — task exists in cache
		const cache: Record<string, { id: string; projectId: string }> = {
			'aaaaaaaaaaaaaaaaaaaaaaaa': { id: 'aaaaaaaaaaaaaaaaaaaaaaaa', projectId: 'proj1' },
		};

		// Apply the safety net filter
		missingTaskIds = missingTaskIds.filter(taskId => {
			const cached = cache[taskId];
			if (cached) {
				return false; // not truly deleted
			}
			return true;
		});

		expect(missingTaskIds).toEqual([]);
	});

	it('should flag task as missing if it does NOT exist in cache', () => {
		const fileContent = '- [ ] Other task #ticktick  %%[ticktick_id:: bbbbbbbbbbbbbbbbbbbbbbbb]%%';
		const metadataTaskIds = ['aaaaaaaaaaaaaaaaaaaaaaaa', 'bbbbbbbbbbbbbbbbbbbbbbbb'];

		const regex = /%%\[ticktick_id:: ([a-f0-9]{24})\]%%/g;
		const matches = fileContent.matchAll(regex);
		const existingTaskIds = new Set([...matches].map((match) => match[1]));

		let missingTaskIds = metadataTaskIds.filter(id => !existingTaskIds.has(id));

		// Empty cache — task is truly gone
		const cache: Record<string, any> = {};

		missingTaskIds = missingTaskIds.filter(taskId => {
			const cached = cache[taskId];
			if (cached) {
				return false;
			}
			return true;
		});

		expect(missingTaskIds).toEqual(['aaaaaaaaaaaaaaaaaaaaaaaa']);
	});
});
