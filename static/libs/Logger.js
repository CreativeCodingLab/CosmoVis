/*
 * The MIT License (MIT)
 * Copyright (c) 2022 Karl STEIN
 */

import levels, {
    DEBUG,
    ERROR,
    FATAL,
    INFO,
    WARN,
  } from './levels';
  import consoleOutput from './outputs/consoleOutput';
  import { getErrorDetails } from './util';
  
  const defaultOptions = {
    active: true,
    defaultContext: null,
    filter: null,
    level: INFO,
    name: null,
    outputs: [consoleOutput()],
  };
  
  class Logger {
    constructor(options = {}) {
      // Use default options.
      const opts = { ...defaultOptions, ...options };
  
      // Set logger status.
      this.active = opts.active === true;
  
      // Set default log context.
      this.defaultContext = opts.defaultContext;
  
      // Set logs filter.
      this.filter = opts.filter;
  
      // Set minimal log level.
      this.level = opts.level;
  
      // Set logger name.
      this.name = opts.name == null ? `logger_${Date.now()}` : String(opts.name);
  
      // Set log outputs.
      this.outputs = [].concat(opts.outputs || []);
  
      if (typeof this.outputs !== 'object' || !(this.outputs instanceof Array) || this.outputs.length === 0) {
        throw new Error('Logger outputs cannot be empty.');
      }
    }
  
    /**
     * Logs a debug message.
     * @param {string} message
     * @param context
     */
    debug(message, context = undefined) {
      this.log(DEBUG, message, context);
    }
  
    /**
     * Logs an error message.
     * @param {string|Error} messageOrError
     * @param context
     */
    error(messageOrError, context = undefined) {
      const ctx = context || {};
      let message = messageOrError;
  
      if (messageOrError instanceof Error) {
        message = messageOrError.message;
        ctx.error = getErrorDetails(messageOrError);
      }
      this.log(ERROR, message, ctx);
    }
  
    /**
     * Logs a fatal error message.
     * @param {string|Error} messageOrError
     * @param context
     */
    fatal(messageOrError, context = undefined) {
      const ctx = context || {};
      let message = messageOrError;
  
      if (messageOrError instanceof Error) {
        message = messageOrError.message;
        ctx.error = getErrorDetails(messageOrError);
      }
      this.log(FATAL, message, ctx);
    }
  
    /**
     * Returns the log level.
     * @return {string}
     */
    getLevel() {
      return this.level;
    }
  
    /**
     * Returns the logger name.
     * @return {string|null}
     */
    getName() {
      return this.name;
    }
  
    /**
     * Logs an informational message.
     * @param {string} message
     * @param context
     */
    info(message, context = undefined) {
      this.log(INFO, message, context);
    }
  
    /**
     * Checks if the logging is active.
     * @return {boolean}
     */
    isActive() {
      return this.active === true;
    }
  
    /**
     * Logs a message with a certain level.
     * @param {string} level
     * @param {string} message
     * @param context
     */
    log(level, message, context = undefined) {
      // Ignore if logger is not active or if log level is higher.
      if (!this.isActive() || levels.indexOf(this.level) > levels.indexOf(level)) {
        return;
      }
  
      // Prepare log event.
      const event = {
        context: this.defaultContext ? { ...this.defaultContext, ...context } : context,
        level,
        logger: this.name,
        message,
        timestamp: Date.now(),
      };
  
      // Filter log event.
      if (typeof this.filter === 'function' && this.filter(event) !== true) {
        return;
      }
  
      // Pass log event to outputs.
      this.outputs.forEach((output) => {
        output(event);
      });
    }
  
    /**
     * Enables or disables logging.
     * @param {boolean} active
     */
    setActive(active) {
      this.active = active === true;
    }
  
    /**
     * Changes the log level.
     * @param {string} level
     */
    setLevel(level) {
      this.level = level;
    }
  
    /**
     * Logs a warning message.
     * @param {string} message
     * @param context
     */
    warn(message, context = undefined) {
      this.log(WARN, message, context);
    }
  }
  
  export default Logger;