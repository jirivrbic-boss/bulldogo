/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const projectRoot = process.cwd();
const publicDir = path.join(projectRoot, 'public');

function removeDirIfExists(dirPath) {
	if (fs.existsSync(dirPath)) {
		for (const entry of fs.readdirSync(dirPath)) {
			const entryPath = path.join(dirPath, entry);
			const stat = fs.lstatSync(entryPath);
			if (stat.isDirectory()) {
				removeDirIfExists(entryPath);
			} else {
				fs.unlinkSync(entryPath);
			}
		}
		fs.rmdirSync(dirPath);
	}
}

function ensureDir(dirPath) {
	if (!fs.existsSync(dirPath)) {
		fs.mkdirSync(dirPath, { recursive: true });
	}
}

function copyFileSync(src, dest) {
	ensureDir(path.dirname(dest));
	fs.copyFileSync(src, dest);
}

function copyDirSync(src, dest) {
	const stat = fs.statSync(src);
	if (!stat.isDirectory()) {
		throw new Error(`Source is not a directory: ${src}`);
	}
	ensureDir(dest);
	for (const entry of fs.readdirSync(src)) {
		const srcPath = path.join(src, entry);
		const destPath = path.join(dest, entry);
		const s = fs.lstatSync(srcPath);
		if (s.isDirectory()) {
			copyDirSync(srcPath, destPath);
		} else {
			copyFileSync(srcPath, destPath);
		}
	}
}

function main() {
	// Clean public directory
	removeDirIfExists(publicDir);
	ensureDir(publicDir);

	// Whitelisted root files by extension
	const allowedExtensions = new Set([
		'.html',
		'.css',
		'.js',
		'.svg',
		'.xml',
		'.webmanifest',
		'.txt',
		'.png',
		'.jpg',
		'.jpeg',
		'.gif',
		'.ico',
		'.map'
	]);

	// Whitelisted directories to copy recursively
	const allowedDirs = new Set([
		'fotky',
		'soubory'
	]);

	// Copy root files
	for (const entry of fs.readdirSync(projectRoot)) {
		const srcPath = path.join(projectRoot, entry);
		// Skip build/system folders and files
		if (
			entry === 'node_modules' ||
			entry === '.git' ||
			entry === 'public' ||
			entry === 'lib' ||
			entry === 'scripts'
		) {
			continue;
		}
		const stat = fs.lstatSync(srcPath);
		if (stat.isFile()) {
			const ext = path.extname(entry).toLowerCase();
			if (allowedExtensions.has(ext)) {
				copyFileSync(srcPath, path.join(publicDir, entry));
			}
		}
	}

	// Copy allowed directories if they exist
	for (const dirName of allowedDirs) {
		const srcDir = path.join(projectRoot, dirName);
		if (fs.existsSync(srcDir) && fs.lstatSync(srcDir).isDirectory()) {
			copyDirSync(srcDir, path.join(publicDir, dirName));
		}
	}

	console.log('Public assets prepared in ./public');
}

main();


