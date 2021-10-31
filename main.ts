// daily-note-archiver
//
// Archive older daily notes into a folder structure configurable by the user.
// Only top-level daily notes will be archived.

import type { Moment } from "moment";
import moment from "moment";
import { Plugin, Notice, TFile } from 'obsidian';
import {
  appHasDailyNotesPluginLoaded,
  getAllDailyNotes,
  getDailyNoteSettings,
} from "obsidian-daily-notes-interface";

export default class DailyNoteArchiverPlugin extends Plugin {
  async onload() {
    try {
      // Give the Daily Notes plugin a chance to load.
      await this.waitForDailyNotesPluginWithTimeout(/*waitMillis=*/1000);
      this.setupPlugin();
    } catch(err) {
      new Notice('DailyNoteArchiver plugin requires Daily Notes plugin to be enabled');
      console.log(err);
    }
  }

  // Assumes Daily Notes plugin is loaded.
  private setupPlugin() {
    // TODO(eht): add settings
    const pluginSettings: any = {
      num_unarchived_daily_notes: 10,
      archive_dated_path_format: 'YYYY/MM'
    };
    let dailyNoteSettings = getDailyNoteSettings();
    // For some reason, sometimes the file extension is missing.
    if (!dailyNoteSettings.template.endsWith('.md')) {
      dailyNoteSettings.template += '.md';
    }

    const files = this.getFilePathsForDailyNotesToArchive(pluginSettings, dailyNoteSettings);
    files.forEach((file: string) => {
      const new_path = this.archivedPathForFile(file, pluginSettings, dailyNoteSettings);
      console.log(`DailyNoteArchiver moving files\n  from: "${file.path}"\n    to: "${new_path}"`);
      this.moveFileToPath(file, new_path);
    });
  }

  private waitForDailyNotesPluginWithTimeout(waitMillis: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const startTime = moment.now();
      const intervalId = window.setInterval(() => {
        if (appHasDailyNotesPluginLoaded()) {
          clearInterval(intervalId);
        resolve();
      } else if (moment.now() - startTime > waitMillis) {
          clearInterval(intervalId);
          reject();
        }
      }, 100);
      this.registerInterval(intervalId);
    });
  }

  private getFilePathsForDailyNotesToArchive(pluginSettings: any, dailyNoteSettings: any): string[] {
    return Object.values(getAllDailyNotes()).sort((a: string, b: string) => {
      // Sort by ascending filename.
      return a.path.localeCompare(b.path);
    }).filter((f: TFile) => {
      // Only keep top-level daily notes.
      return f.parent.path === dailyNoteSettings.folder;
    }).slice(0, -pluginSettings.num_unarchived_daily_notes);
  };

  private archivedPathForFile(file: TFile, pluginSettings: any, dailyNoteSettings: any): string {
    const file_date: Moment =
        this.parseDateWithFormat(file.basename, dailyNoteSettings.format);
    const date_path_part = file_date.format(
        pluginSettings.archive_dated_path_format.replace(/^\/|\/$/g, ''));
    return [file.parent.path, date_path_part, file.name].join('/');
  };

  // Parses the dateString with the given format using the Moment library.
  private parseDateWithFormat(dateString: string, format: string): Moment {
    return moment(dateString, format, /*strictMode=*/true);
  };

  private moveFileToPath(file: TFile, new_path: string): Promise<void> {
    const mv = () => this.app.vault.rename(file, new_path);
    return this.app.vault.createFolder(this.dirname(new_path)).then(mv, mv);
  }

  private dirname(path: string): string {
    return path.slice(0, path.lastIndexOf('/'));
  }
}
