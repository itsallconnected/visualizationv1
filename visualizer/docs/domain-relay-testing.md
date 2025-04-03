# Domain Relay Testing Guide

This document provides instructions for testing the domain relay setup with AWS Amplify. Follow these steps to verify that your domain configuration is working correctly.

## Testing Checklist

### Basic Domain Access Tests

- [ ] Verify the application loads correctly at the custom domain URL
- [ ] Check that all static assets (JS, CSS, images) load without errors
- [ ] Confirm that no mixed content warnings appear in browser console
- [ ] Test navigation between different routes to ensure client-side routing works

### SSL Certificate Verification

- [ ] Verify that HTTPS is working (secure padlock appears in browser)
- [ ] Check certificate validity and expiration date
- [ ] Confirm that the certificate covers both root domain and www subdomain
- [ ] Test HSTS header is properly set (`Strict-Transport-Security`)

### DNS Configuration Tests

#### Without www Prefix

- [ ] Visit the domain without www prefix (e.g., `https://example.com`)
- [ ] Verify that it loads the application correctly
- [ ] Check that all application features work as expected
- [ ] Confirm the correct SSL certificate is being used

#### With www Prefix

- [ ] Visit the domain with www prefix (e.g., `https://www.example.com`)
- [ ] Verify that it redirects to the configured primary domain or loads correctly
- [ ] Check that all application features work after the redirect
- [ ] Confirm the SSL certificate is valid for this subdomain

### Redirect Tests

- [ ] Test HTTP to HTTPS redirection
- [ ] If applicable, test www to non-www redirection (or vice versa)
- [ ] Verify that deep links redirect correctly
- [ ] Confirm that trailing slashes are handled correctly

### Cache Headers and Performance

- [ ] Verify custom cache headers are applied as specified in `amplify.yml`
- [ ] Check browser caching is working for static assets
- [ ] Confirm that the CDN is caching content properly
- [ ] Run a Lighthouse performance test to verify optimizations

### Error Page Tests

- [ ] Test 404 page by navigating to a non-existent route
- [ ] Verify that 404 routing works for deep links
- [ ] Check that 5xx error pages display correctly if applicable
- [ ] Confirm that error pages maintain styling and branding

## Using AWS Amplify Console for Verification

1. Log in to the AWS Management Console
2. Navigate to AWS Amplify service
3. Select your application from the list
4. Navigate to the "Domain management" section
5. Verify domain status shows as "Available"
6. Check the SSL certificate status is "Issued"
7. Review any warnings or errors in the domain configuration

## Browser-Specific Testing

Test your domain configuration in multiple browsers to ensure compatibility:

- [ ] Google Chrome
- [ ] Mozilla Firefox
- [ ] Safari
- [ ] Microsoft Edge
- [ ] Mobile browsers (iOS Safari, Android Chrome)

## Troubleshooting Common Issues

### DNS Propagation Delays

If your domain isn't resolving correctly, it may be due to DNS propagation delays:
- DNS changes can take up to 48 hours to fully propagate
- Use tools like [DNS Checker](https://dnschecker.org) to verify propagation
- Test from different networks and geographic locations

### SSL Certificate Issues

If you encounter SSL certificate errors:
- Verify that your domain validation is complete in AWS Certificate Manager
- Check that the certificate includes all required domains and subdomains
- Confirm that the certificate is correctly associated with your CloudFront distribution

### Redirect Loops

If you experience redirect loops:
- Check for conflicting redirect rules in Amplify configuration
- Verify that DNS records are pointing to the correct AWS resources
- Ensure you don't have additional redirects configured at the DNS level

### Mixed Content Warnings

If mixed content warnings appear:
- Look for hard-coded HTTP URLs in your application
- Check for resources loaded from external domains without HTTPS
- Use a content security policy to prevent mixed content

## Reporting Issues

If you encounter persistent issues with your domain configuration:
1. Capture screenshots of any error messages
2. Note the specific URLs that are failing
3. Document the steps to reproduce the issue
4. Collect browser console logs and network request information
5. Contact AWS Support or file an issue in the project repository

## Additional Resources

- [AWS Amplify Custom Domain Documentation](https://docs.aws.amazon.com/amplify/latest/userguide/custom-domains.html)
- [AWS Certificate Manager User Guide](https://docs.aws.amazon.com/acm/latest/userguide/acm-overview.html)
- [DNS and HTTPS Troubleshooting](https://docs.aws.amazon.com/amplify/latest/userguide/troubleshooting-http-issues.html) 