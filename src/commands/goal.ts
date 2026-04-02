import { Command } from 'commander';
import { getGoalHours, getGoalSummary, renderGoalStatus, setGoalHours } from '../goal.js';

export function registerGoal(program: Command): void {
  const goal = program.command('goal').description('Set and track your sleep duration goal');

  goal
    .command('set')
    .argument('<hours>', 'Goal hours per night')
    .action((hours: string) => {
      const value = Number(hours);

      try {
        setGoalHours(value);
        console.log(`Goal set: ${value} hours per night`);
      } catch (error) {
        console.error((error as Error).message);
        process.exit(1);
      }
    });

  goal.command('status').action(() => {
    const goalHours = getGoalHours();
    if (goalHours === null) {
      console.error('No sleep goal set. Run `sleep-compiler goal set <hours>` first.');
      process.exit(1);
    }

    const summary = getGoalSummary(goalHours);
    console.log(renderGoalStatus(summary));
  });
}
