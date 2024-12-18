# gpt-files

## Description

`gpt-files` is a CLI tool for managing files for OpenAI assistant.

## Installation

### Using npm

```sh
npm install -g gpt-files
```

## Usage

### Development

To run the CLI tool in development mode:

```sh
deno task dev -- [command] [options]
```

### Compilation

To compile the CLI tool for different platforms:

```sh
deno task compile
```

This will generate the binaries in the `dist` directory for the following
platforms:

- Linux x86_64
- Linux ARM64
- macOS x86_64
- macOS ARM64

## Commands

To see the available commands and options, run `--help` not only in root command
but also recursively:

```sh
gpt-files --help
gpt-files upload --help
```

## Configuration

### `deno.json`

This file contains the configuration for Deno tasks, formatting options,
compiler options, and module imports.

### `package.json`

This file contains the npm configuration for the project, including the binary
entry point and files to include.
