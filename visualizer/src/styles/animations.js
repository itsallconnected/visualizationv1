import { css, keyframes } from 'styled-components';
import theme from './theme';

/**
 * Keyframe animations for the application.
 * These can be imported and used in styled components.
 */

// Fade in animation
export const fadeIn = keyframes`
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
`;

// Fade out animation
export const fadeOut = keyframes`
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
`;

// Slide in from right
export const slideInRight = keyframes`
  from {
    transform: translateX(100%);
  }
  to {
    transform: translateX(0);
  }
`;

// Slide out to right
export const slideOutRight = keyframes`
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(100%);
  }
`;

// Slide in from left
export const slideInLeft = keyframes`
  from {
    transform: translateX(-100%);
  }
  to {
    transform: translateX(0);
  }
`;

// Slide out to left
export const slideOutLeft = keyframes`
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(-100%);
  }
`;

// Slide in from top
export const slideInTop = keyframes`
  from {
    transform: translateY(-100%);
  }
  to {
    transform: translateY(0);
  }
`;

// Slide out to top
export const slideOutTop = keyframes`
  from {
    transform: translateY(0);
  }
  to {
    transform: translateY(-100%);
  }
`;

// Slide in from bottom
export const slideInBottom = keyframes`
  from {
    transform: translateY(100%);
  }
  to {
    transform: translateY(0);
  }
`;

// Slide out to bottom
export const slideOutBottom = keyframes`
  from {
    transform: translateY(0);
  }
  to {
    transform: translateY(100%);
  }
`;

// Scale in animation
export const scaleIn = keyframes`
  from {
    transform: scale(0);
  }
  to {
    transform: scale(1);
  }
`;

// Scale out animation
export const scaleOut = keyframes`
  from {
    transform: scale(1);
  }
  to {
    transform: scale(0);
  }
`;

// Rotate animation
export const rotate = keyframes`
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
`;

// Pulse animation
export const pulse = keyframes`
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
  100% {
    transform: scale(1);
  }
`;

// Shake animation
export const shake = keyframes`
  0%, 100% {
    transform: translateX(0);
  }
  10%, 30%, 50%, 70%, 90% {
    transform: translateX(-5px);
  }
  20%, 40%, 60%, 80% {
    transform: translateX(5px);
  }
`;

// Bounce animation
export const bounce = keyframes`
  0%, 20%, 50%, 80%, 100% {
    transform: translateY(0);
  }
  40% {
    transform: translateY(-20px);
  }
  60% {
    transform: translateY(-10px);
  }
`;

/**
 * Animation mixins for common animation patterns.
 * These can be used in styled components with the css helper.
 */

// Fade in animation with customizable duration and delay
export const fadeInAnimation = (duration = 0.3, delay = 0) => css`
  animation: ${fadeIn} ${duration}s ${theme.transitions.easing.easeOut} ${delay}s both;
`;

// Fade out animation with customizable duration and delay
export const fadeOutAnimation = (duration = 0.3, delay = 0) => css`
  animation: ${fadeOut} ${duration}s ${theme.transitions.easing.easeIn} ${delay}s both;
`;

// Slide in from right animation with customizable duration and delay
export const slideInRightAnimation = (duration = 0.3, delay = 0) => css`
  animation: ${slideInRight} ${duration}s ${theme.transitions.easing.easeOut} ${delay}s both;
`;

// Slide out to right animation with customizable duration and delay
export const slideOutRightAnimation = (duration = 0.3, delay = 0) => css`
  animation: ${slideOutRight} ${duration}s ${theme.transitions.easing.easeIn} ${delay}s both;
`;

// Scale in animation with customizable duration and delay
export const scaleInAnimation = (duration = 0.3, delay = 0) => css`
  animation: ${scaleIn} ${duration}s ${theme.transitions.easing.easeOut} ${delay}s both;
`;

// Scale out animation with customizable duration and delay
export const scaleOutAnimation = (duration = 0.3, delay = 0) => css`
  animation: ${scaleOut} ${duration}s ${theme.transitions.easing.easeIn} ${delay}s both;
`;

// Transition for hover effects
export const hoverTransition = css`
  transition: all 0.2s ${theme.transitions.easing.easeInOut};
`;

// Transition for expanding/collapsing elements
export const expandTransition = css`
  transition: height 0.3s ${theme.transitions.easing.easeInOut},
              opacity 0.3s ${theme.transitions.easing.easeInOut};
`;

// Transition for moving elements
export const moveTransition = css`
  transition: transform 0.3s ${theme.transitions.easing.easeInOut};
`;

// Pulse animation with customizable duration
export const pulseAnimation = (duration = 2) => css`
  animation: ${pulse} ${duration}s infinite ease-in-out;
`;

// Rotate animation with customizable duration
export const rotateAnimation = (duration = 1) => css`
  animation: ${rotate} ${duration}s linear infinite;
`;

/**
 * Animation utilities for specific UI elements
 */

// Animation for node selection highlight
export const nodeSelectionAnimation = css`
  ${pulseAnimation(1.5)}
`;

// Animation for newly added nodes
export const newNodeAnimation = css`
  ${scaleInAnimation(0.5)}
`;

// Animation for removing nodes
export const removeNodeAnimation = css`
  ${scaleOutAnimation(0.3)}
`;

// Animation for notification appearance
export const notificationAnimation = css`
  ${slideInRightAnimation(0.3)}
`;

// Animation for button hover effect
export const buttonHoverEffect = css`
  ${hoverTransition}
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  }
`;

// Animation for expanding panels
export const expandPanelAnimation = css`
  ${expandTransition}
`;

export default {
  fadeIn,
  fadeOut,
  slideInRight,
  slideOutRight,
  slideInLeft,
  slideOutLeft,
  slideInTop,
  slideOutTop,
  slideInBottom,
  slideOutBottom,
  scaleIn,
  scaleOut,
  rotate,
  pulse,
  shake,
  bounce,
  fadeInAnimation,
  fadeOutAnimation,
  slideInRightAnimation,
  slideOutRightAnimation,
  scaleInAnimation,
  scaleOutAnimation,
  hoverTransition,
  expandTransition,
  moveTransition,
  pulseAnimation,
  rotateAnimation,
  nodeSelectionAnimation,
  newNodeAnimation,
  removeNodeAnimation,
  notificationAnimation,
  buttonHoverEffect,
  expandPanelAnimation,
}; 