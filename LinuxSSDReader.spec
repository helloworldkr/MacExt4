# -*- mode: python ; coding: utf-8 -*-

block_cipher = None

a = Analysis(
    ['desktop_app.py'],
    pathex=['.'],
    binaries=[],
    datas=[
        ('static', 'static'),
        ('sample_linux_disk.img', '.'),
    ],
    hiddenimports=[
        'uvicorn',
        'uvicorn.loops',
        'uvicorn.loops.auto',
        'uvicorn.protocols',
        'uvicorn.protocols.http',
        'uvicorn.protocols.http.auto',
        'uvicorn.protocols.websockets',
        'uvicorn.protocols.websockets.auto',
        'uvicorn.lifespan',
        'uvicorn.lifespan.on',
        'fastapi',
        'starlette',
        'ext4',
        'webview',
        'webview.platforms.cocoa',
        'objc',
        'Foundation',
        'AppKit',
        'WebKit',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='LinuxSSDReader',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='LinuxSSDReader',
)

app = BUNDLE(
    coll,
    name='LinuxSSDReader.app',
    icon='AppIcon.icns',
    bundle_identifier='com.antigravity.linuxssdreader',
    info_plist={
        'CFBundleName': 'Linux SSD Reader',
        'CFBundleDisplayName': 'Linux SSD Reader',
        'CFBundleGetInfoString': "Read and explore Linux ext2/ext3/ext4 SSDs and disks on macOS",
        'CFBundleIdentifier': "com.antigravity.linuxssdreader",
        'CFBundleVersion': "1.0.0",
        'CFBundleShortVersionString': "1.0.0",
        'NSHumanReadableCopyright': "Copyright © 2026 Antigravity",
        'NSHighResolutionCapable': True,
        'LSApplicationCategoryType': 'public.app-category.utilities',
        'NSAppleEventsUsageDescription': 'Linux SSD Reader requires permission to access external hardware disks.',
    },
)
