import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateLinkGroupProjectDto } from './dto/create-link-group-project.dto';
import { UpdateLinkGroupProjectDto } from './dto/update-link-group-project.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { LinkGroupProject } from './entities/link-group-project.entity';
import { In, Repository } from 'typeorm';
import { UserGroup } from '../../BaseEntities/user-group/entities/user-group.entity';
import { GroupProjectRights } from '../../enum/rights';
import { CustomLogger } from '../../utils/Logger/CustomLogger.service';
import { UpdateProjectGroupDto } from './dto/updateProjectGroupDto';
import { ProjectService } from '../../BaseEntities/project/project.service';
import { UserGroupService } from '../../BaseEntities/user-group/user-group.service';
import { AddProjectToGroupDto } from './dto/addProjectToGroupDto';
import { removeProjectToGroupDto } from './dto/removeProjectToGroupDto';
import { CreateProjectDto } from '../../BaseEntities/project/dto/create-project.dto';
import { LinkUserGroupService } from '../link-user-group/link-user-group.service';
import { Project } from '../../BaseEntities/project/entities/project.entity';
import { UpdateAccessToProjectDto } from './dto/updateAccessToProjectDto';
import { ActionType } from '../../enum/actions';
import { generateAlphanumericSHA1Hash } from '../../utils/hashGenerator';
import * as fs from 'fs';

@Injectable()
export class LinkGroupProjectService {
  private readonly logger = new CustomLogger();

  constructor(
    @InjectRepository(LinkGroupProject)
    private readonly linkGroupProjectRepository: Repository<LinkGroupProject>,
    private readonly projectService: ProjectService,
    private readonly groupService: UserGroupService,
    private readonly linkUserGroupService: LinkUserGroupService,
  ) {}
  async create(createLinkGroupProjectDto: CreateLinkGroupProjectDto) {
    try {
      const linkGroupProject: LinkGroupProject =
        this.linkGroupProjectRepository.create({
          ...createLinkGroupProjectDto,
        });

      return await this.linkGroupProjectRepository.upsert(linkGroupProject, {
        conflictPaths: ['rights', 'project', 'user_group'],
      });
    } catch (error) {
      this.logger.error(error.message, error.stack);
      throw new InternalServerErrorException(
        'An error occurred while creating the linkGroupProject',
        error,
      );
    }
  }


  async findOne(id: number) {
    try {
      return await this.linkGroupProjectRepository.findOneBy({ id });
    } catch (error) {
      this.logger.error(error.message, error.stack);
      throw new InternalServerErrorException(
        'An error occurred while finding the linkGroupProject',
        error,
      );
    }
  }

  async findAllGroupProjectByUserGroupId(userId: number) {
    try {
      return await this.linkGroupProjectRepository.find({
        where: { user_group: { id: userId } },
        relations: ['project'],
      });
    } catch (error) {
      throw new InternalServerErrorException(
        `An error occurred while finding Group for this project id : ${userId}`,
        error,
      );
    }
  }

  async update(
    linkGroupId: number,
    updateLinkGroupProjectDto: UpdateLinkGroupProjectDto,
  ) {
    try {
      const done = await this.linkGroupProjectRepository.update(
        linkGroupId,
        updateLinkGroupProjectDto,
      );
      if (done.affected != 1) throw new NotFoundException(linkGroupId);
      return this.findOne(linkGroupId);
    } catch (error) {
      this.logger.error(error.message, error.stack);
      throw new InternalServerErrorException(
        'An error occurred while updating the linkGroupProject',
        error,
      );
    }
  }

  async duplicateProject(projectId: number): Promise<LinkGroupProject> {
    try {
      const originalProject = await this.linkGroupProjectRepository.findOne({
        where: { project: { id: projectId } },
        relations: ['project', 'user_group'],
      });
      if (!originalProject) {
        throw new NotFoundException(`Object with ID ${projectId} not found`);
      }
      return await this.createProject({
        title: originalProject.project.title,
        ownerId: originalProject.project.ownerId,
        metadata: originalProject.project.metadata,
      });
    } catch (error) {
      this.logger.error(error.message, error.stack);
      throw new InternalServerErrorException(error);
    }
  }

  async getProjectRelations(projectId: number) {
    try {
      return await this.linkGroupProjectRepository.find({
        where: { project: { id: projectId } },
        relations: ['user_group'],
      });
    } catch (error) {
      this.logger.error(error.message, error.stack);
      throw new InternalServerErrorException(error);
    }
  }

  async UpdateRelation(
    project_Id: number,
    user_group_Id: number,
    updatedRights: GroupProjectRights,
  ) {
    try {
      // Fetch the LinkGroupProject entity
      const linkGroupToUpdate = await this.linkGroupProjectRepository.findOne({
        where: {
          user_group: { id: user_group_Id },
          project: { id: project_Id },
        },
      });

      // Ensure that the entity exists
      if (!linkGroupToUpdate) {
        throw new NotFoundException('No matching LinkGroupProject found');
      }

      linkGroupToUpdate.rights = updatedRights;
      const updatedData =
        await this.linkGroupProjectRepository.save(linkGroupToUpdate);

      return updatedData;
    } catch (error) {
      this.logger.error(error.message, error.stack);
      throw new InternalServerErrorException(error);
    }
  }

  async removeProjectGroupRelation(projectId: number, group: UserGroup) {
    try {
      const done = await this.linkGroupProjectRepository.delete({
        project: { id: projectId },
        user_group: { id: group.id },
      });
      if (done.affected != 1) throw new NotFoundException(projectId);
      return done;
    } catch (error) {
      this.logger.error(error.message, error.stack);
      throw new InternalServerErrorException(
        'An error occurred while removing the linkGroupProject',
        error,
      );
    }
  }

  async updateProject(dto: UpdateProjectGroupDto) {
    try {
      let projectToReturn;
      if (dto.rights && dto.group) {
        await this.UpdateRelation(dto.project.id, dto.group.id, dto.rights);
        await this.projectService.update(dto.project.id, dto.project);
        projectToReturn = await this.getProjectRelations(dto.id);
      } else {
        projectToReturn = await this.projectService.update(
          dto.project.id,
          dto.project,
        );
      }
      return projectToReturn;
    } catch (error) {
      this.logger.error(error.message, error.stack);
      throw new InternalServerErrorException(error);
    }
  }

  async updateAccessToProject(
    updateAccessToProjectDto: UpdateAccessToProjectDto,
  ) {
    try {
      const projectToUpdate = await this.projectService.findOne(
        updateAccessToProjectDto.projectId,
      );
      const groupToUpdate = await this.groupService.findOne(
        updateAccessToProjectDto.groupId,
      );
      const linkGroupToUpdate = await this.linkGroupProjectRepository.findOne({
        where: {
          project: { id: projectToUpdate.id },
          user_group: { id: groupToUpdate.id },
        },
      });
      const updateRights = await this.linkGroupProjectRepository.update(
        linkGroupToUpdate.id,
        {
          user_group: groupToUpdate,
          project: projectToUpdate,
          rights: updateAccessToProjectDto.rights,
        },
      );

      return updateRights;
    } catch (error) {
      this.logger.error(error.message, error.stack);
      throw new InternalServerErrorException(
        `an error occurred while trying to update access to project with id ${updateAccessToProjectDto.projectId} to group with id: ${updateAccessToProjectDto.groupId}`,
        error,
      );
    }
  }

  async addProjectToGroup(dto: AddProjectToGroupDto) {
    const { groupId, projectId } = dto;
    try {
      const userGroup = await this.groupService.findOne(groupId);
      if (!userGroup) {
        throw new InternalServerErrorException(
          `Group with id ${groupId} not found`,
        );
      }
      const project = await this.projectService.findOne(projectId);
      if (!project) {
        throw new InternalServerErrorException(
          `Project with id ${projectId} not found`,
        );
      }
      await this.create({
        rights: dto.rights ? dto.rights : GroupProjectRights.READER,
        user_group: userGroup,
        project: project,
      });
      return await this.findAllGroupProjectByUserGroupId(projectId);
    } catch (error) {
      this.logger.error(error.message, error.stack);
      throw new InternalServerErrorException(
        `an error occurred while trying to add project id ${dto.projectId} to group id: ${dto.groupId}`,
        error,
      );
    }
  }

  async deleteProject(project_id: number) {
    try {
      const projectRelation = await this.getProjectRelations(project_id);
      for (const linkGroupProject of projectRelation) {
        await this.RemoveProjectToGroup({
          projectId: project_id,
          groupId: linkGroupProject.user_group.id,
        });
      }
      return await this.projectService.remove(project_id);
    } catch (error) {
      this.logger.error(error.message, error.stack);
      throw new InternalServerErrorException(error);
    }
  }

  async RemoveProjectToGroup(dto: removeProjectToGroupDto) {
    try {
      const linkGroupProjects = await this.findAllGroupProjectByUserGroupId(
        dto.groupId,
      );

      const projectId = Number(dto.projectId);
      const projectToRemove = linkGroupProjects.find(
        (linkGroupProject) => linkGroupProject.project.id == projectId,
      );
      const groupToRemove = await this.groupService.findOne(dto.groupId);
      if (!projectToRemove) {
        throw new NotFoundException(
          `No association between Project with ID ${dto.projectId} and group with ID ${dto.groupId}`,
        );
      }
      return await this.removeProjectGroupRelation(
        projectToRemove.project.id,
        groupToRemove,
      );
    } catch (error) {
      this.logger.error(error.message, error.stack);
      throw new InternalServerErrorException(
        `an error occurred while removing project id : ${dto.projectId} from group id ${dto.groupId}`,
        error,
      );
    }
  }

  async getProjectRightForUser(userGroupId: number, projectId: number) {
    try {
      const project = await this.findAllGroupProjectByUserGroupId(userGroupId);

      return project.find(
        (linkGroupProject) => linkGroupProject.project.id == projectId,
      );
    } catch (error) {
      this.logger.error(error.message, error.stack);
      throw new InternalServerErrorException(error);
    }
  }

  async searchForUserGroupProjectWithPartialProjectName(
    partialUserName: string,
    userGroupId: number,
  ) {
    try {
      const arrayOfProjects =
        await this.projectService.findProjectsByPartialNameAndUserGroup(
          partialUserName,
          userGroupId,
        );
      const userProjects = [];
      for (const projets of arrayOfProjects) {
        const userPorject = await this.getProjectRightForUser(
          userGroupId,
          projets.id,
        );
        userProjects.push(userPorject);
      }
      return userProjects;
    } catch (error) {
      this.logger.error(error.message, error.stack);
      throw new InternalServerErrorException(error);
    }
  }

  async createProject(dto: CreateProjectDto) {
    try {
      const userPersonalGroup =
        await this.linkUserGroupService.findUserPersonalGroup(dto.ownerId);
      if (!userPersonalGroup) {
        throw new NotFoundException(
          `there is no user personal group for : ${dto.ownerId}`,
        );
      }
      const project = await this.projectService.create({
        ...dto,
        metadata: { ...dto.metadata, creator: userPersonalGroup.title },
      });
      await this.addProjectToGroup({
        groupId: userPersonalGroup.id,
        projectId: project.id,
        rights: GroupProjectRights.ADMIN,
      });
      return await this.getProjectRightForUser(
        userPersonalGroup.id,
        project.id,
      );
    } catch (error) {
      this.logger.error(error.message, error.stack);
      throw new InternalServerErrorException(
        'an error occurred while creating project',
        error,
      );
    }
  }

  async findAllUserProjects(userId: number) {
    try {
      const usersGroups =
        await this.linkUserGroupService.findALlGroupsForUser(userId);
      let projects: Project[] = [];
      for (const usersGroup of usersGroups) {
        const groupProjects = await this.findAllGroupProjectByUserGroupId(
          usersGroup.id,
        );

        const userProjects = groupProjects.map((groupProjects) => {
          return {
            ...groupProjects.project,
            rights: groupProjects.rights,
          };
        });
        projects = projects.concat(
          userProjects.filter((project) => !projects.includes(project)),
        );
      }
      return projects;
    } catch (error) {
      this.logger.error(error.message, error.stack);
      throw new InternalServerErrorException(
        `an error occurred while finding project for userId: ${userId}`,
        error,
      );
    }
  }

  async getHighestRightForProject(userId: number, projectId: number) {
    const userGroups =
      await this.linkUserGroupService.findALlGroupsForUser(userId);
    const linkEntities = await this.linkGroupProjectRepository.find({
      where: {
        user_group: { id: In(userGroups.map((group) => group.id)) },
        project: { id: projectId },
      },
      relations: ['project', 'user_group'],
    });
    if (linkEntities.length === 0) {
      return;
    }

    const rightsPriority = { Admin: 3, Editor: 2, Reader: 1 };
    return linkEntities.reduce((prev, current) => {
      const prevRight = rightsPriority[prev.rights] || 0;
      const currentRight = rightsPriority[current.rights] || 0;
      return currentRight > prevRight ? current : prev;
    });
  }

  async checkPolicies(
    action: string,
    userId: number,
    projectId: number,
    callback: (linkEntity: LinkGroupProject) => any,
  ) {
    try {
      const linkEntity = await this.getHighestRightForProject(
        userId,
        projectId,
      );

      if (!linkEntity) {
        return new ForbiddenException(
          'User does not have access to this project or the project does not exist',
        );
      }
      switch (action) {
        case ActionType.READ:
          if (
            [
              GroupProjectRights.READER,
              GroupProjectRights.ADMIN,
              GroupProjectRights.EDITOR,
            ].includes(linkEntity.rights)
          ) {
            return callback(linkEntity);
          }
          break;
        case ActionType.UPDATE:
          if (
            [GroupProjectRights.ADMIN, GroupProjectRights.EDITOR].includes(
              linkEntity.rights,
            )
          ) {
            return callback(linkEntity);
          }
          break;
        case ActionType.DELETE:
          if (linkEntity.rights === GroupProjectRights.ADMIN) {
            return callback(linkEntity);
          }
          break;

        default:
          throw new InternalServerErrorException('Invalid action');
      }
      return new ForbiddenException('User is not allowed to do this action');
    } catch (error) {
      this.logger.error(error.message, error.stack);
      throw new InternalServerErrorException(`an error occurred`, error);
    }
  }

  async generateProjectSnapshot(projectId: number) {
    try {
      const project = await this.projectService.findOne(projectId);
      const hash = generateAlphanumericSHA1Hash(
        `${project.title}${Date.now().toString()}`,
      );
      const uploadPath = `./upload/${hash}`;

      fs.mkdirSync(uploadPath, { recursive: true });
      const workspaceData = {
        generated_at: Date.now(),
        workspace: project.userWorkspace,
      };
      const workspaceJsonPath = `${uploadPath}/workspace.json`;
      fs.writeFileSync(
        workspaceJsonPath,
        JSON.stringify(workspaceData, null, 2),
        'utf-8',
      );
      await this.projectService.update(projectId, {
        id: projectId,
        snapShotHash: hash,
      });
      return {
        snapShotHash: `${hash}`,
      };
    } catch (error) {
      this.logger.error(error.message, error.stack);
      throw new InternalServerErrorException(`an error occurred`, error);
    }
  }

  async lockProject(projectId: number, lock: boolean, userId: number) {
    try {
      return await this.projectService.lockProject(projectId, lock, userId);
    } catch (error) {
      this.logger.error(error.message, error.stack);
      throw new InternalServerErrorException(`an error occurred`, error);
    }
  }

  async isProjectLocked(
    projectId: number,
    userId: number,
  ): Promise<boolean | number> {
    try {
      const project = await this.projectService.findOne(projectId);
      if (!project) {
        throw new NotFoundException(`Project with ID ${projectId} not found`);
      }
      if (project.lockedByUserId === null && project.lockedAt === null) {
        return false;
      }
      const now = Date.now();
      const isLockRelevant =
        now - 2 * 60 * 1000 < new Date(project.lockedAt).getTime();
      if (isLockRelevant) {
        if (userId == project.lockedByUserId) {
          return project.lockedByUserId;
        }
      }
      return false;
    } catch (error) {
      this.logger.error(
        `Error checking project lock: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'An error occurred while checking project lock',
        error,
      );
    }
  }
}
