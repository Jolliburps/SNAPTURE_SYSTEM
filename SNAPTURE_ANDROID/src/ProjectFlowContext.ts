import { createContext } from 'react';
import type { UserProject } from './api';

export const ProjectFlowContext=createContext<((project:UserProject)=>void)|null>(null);
