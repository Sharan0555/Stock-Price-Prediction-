# Release Instructions

This document explains how to create and publish releases for the Stock Price Prediction platform.

## Prerequisites

- Git access to the repository
- GitHub account with push permissions
- Local development environment set up
- All tests passing

## Release Process

### 1. Pre-release Checklist

Before creating a release, ensure:

- [ ] All tests pass (`pytest` and `npm test`)
- [ ] Documentation is up to date
- [ ] CHANGELOG.md is updated with new features
- [ ] Version number is updated in package.json and setup.py
- [ ] API documentation is current
- [ ] No critical bugs or security issues
- [ ] Performance benchmarks are acceptable
- [ ] Docker images build successfully

### 2. Update Version Numbers

#### Backend Version
```bash
# Edit backend/setup.py
version="1.0.0"  # Update this
```

#### Frontend Version
```bash
# Edit frontend/package.json
"version": "1.0.0"  # Update this
```

### 3. Update CHANGELOG

Add new version entry to CHANGELOG.md:

```markdown
## [1.0.0] - 2026-03-22

### Added
- List all new features
- Bug fixes
- Improvements
```

### 4. Commit Changes

```bash
git add .
git commit -m "chore: prepare v1.0.0 release"
git push origin main
```

### 5. Create Git Tag

```bash
# Create annotated tag
git tag -a v1.0.0 -m "Release v1.0.0"

# Push tag to GitHub
git push origin v1.0.0
```

### 6. Create GitHub Release

#### Via GitHub Web Interface

1. Go to https://github.com/Sharan0555/Stock-Price-Prediction-/releases
2. Click "Create a new release"
3. Choose the tag: `v1.0.0`
4. Release title: `Release v1.0.0`
5. Release description: Use content from CHANGELOG
6. Check "This is a pre-release" (if applicable)
7. Click "Publish release"

#### Via GitHub CLI (Alternative)

```bash
gh release create v1.0.0 \
  --title "Release v1.0.0" \
  --notes "$(cat CHANGELOG.md | sed -n '/## \[1\.0\.0\]/,/##/p' | head -n -1)"
```

### 7. Docker Image Publishing (Optional)

If publishing Docker images:

```bash
# Build and tag Docker images
docker build -t sharan0555/stock-prediction-backend:v1.0.0 ./backend
docker build -t sharan0555/stock-prediction-frontend:v1.0.0 ./frontend

# Push to Docker Hub
docker push sharan0555/stock-prediction-backend:v1.0.0
docker push sharan0555/stock-prediction-frontend:v1.0.0

# Also push latest tag
docker tag sharan0555/stock-prediction-backend:v1.0.0 sharan0555/stock-prediction-backend:latest
docker tag sharan0555/stock-prediction-frontend:v1.0.0 sharan0555/stock-prediction-frontend:latest
docker push sharan0555/stock-prediction-backend:latest
docker push sharan0555/stock-prediction-frontend:latest
```

## Post-release Tasks

### 1. Update Documentation

- Update README.md with new version
- Update installation guides
- Update deployment documentation

### 2. Announce Release

- Create blog post or announcement
- Update social media
- Notify community channels
- Send release notes to stakeholders

### 3. Monitor

- Watch for bug reports
- Monitor performance metrics
- Check download/install statistics
- Gather user feedback

## Release Types

### Major Release (X.0.0)

- Breaking changes
- Major new features
- Architecture changes
- Requires migration steps

### Minor Release (0.X.0)

- New features
- Significant improvements
- Non-breaking changes
- Optional migration steps

### Patch Release (0.0.X)

- Bug fixes
- Security updates
- Minor improvements
- No breaking changes

## Emergency Releases

For critical security issues:

1. Create hotfix branch from main
2. Fix the issue
3. Run tests
4. Create patch release (0.0.X)
5. Merge back to main
6. Announce security update

## Version Bumping Script

Create a script to automate version bumping:

```bash
#!/bin/bash
# bump-version.sh

VERSION=$1
if [ -z "$VERSION" ]; then
    echo "Usage: ./bump-version.sh v1.0.0"
    exit 1
fi

# Update backend version
sed -i.bak "s/version=\".*\"/version=\"$VERSION\"/" backend/setup.py

# Update frontend version
sed -i.bak "s/\"version\": \".*\"/\"version\": \"$VERSION\"/" frontend/package.json

# Clean up backup files
rm backend/setup.py.bak frontend/package.json.bak

echo "Version bumped to $VERSION"
```

## Rollback Procedure

If a release has critical issues:

1. **Immediate Actions**
   - Update release notes with warning
   - Pin to previous stable version
   - Communicate with users

2. **Fix and Re-release**
   - Create hotfix branch
   - Fix issues
   - Run comprehensive tests
   - Create patch release

3. **Long-term**
   - Review release process
   - Improve testing procedures
   - Update checklists

## Release Checklist Template

```
Release: v1.0.0
Date: 2026-03-22

Pre-release:
□ Tests passing
□ Documentation updated
□ Version numbers updated
□ CHANGELOG updated
□ Security review complete
□ Performance tested
□ Docker images built

Release:
□ Git tag created
□ GitHub release published
□ Release notes published
□ Docker images pushed
□ Documentation deployed

Post-release:
□ Monitor for issues
□ User feedback collected
□ Metrics tracked
□ Success metrics documented
```

## Troubleshooting

### Common Issues

**Tag already exists**
```bash
git tag -d v1.0.0
git push origin :refs/tags/v1.0.0
```

**Release fails to publish**
- Check GitHub permissions
- Verify tag exists
- Check release notes format

**Docker push fails**
- Check Docker Hub credentials
- Verify image names
- Check internet connection

### Getting Help

- Check GitHub Actions logs
- Review release documentation
- Contact maintainers
- Search existing issues

---

*Last updated: March 22, 2026*
