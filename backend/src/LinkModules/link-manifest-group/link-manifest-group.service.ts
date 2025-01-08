import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LinkManifestGroup } from './entities/link-manifest-group.entity';
import { Repository } from 'typeorm';
import { ManifestGroupRights } from '../../enum/rights';
import { CustomLogger } from '../../utils/Logger/CustomLogger.service';
import { Manifest } from '../../BaseEntities/manifest/entities/manifest.entity';
import { UserGroup } from '../../BaseEntities/user-group/entities/user-group.entity';
import { ManifestService } from '../../BaseEntities/manifest/manifest.service';
import { UserGroupService } from '../../BaseEntities/user-group/user-group.service';
import { AddManifestToGroupDto } from './dto/add-manifest-to-group.dto';
import { join } from 'path';
import * as fs from 'fs';
import { UpdateManifestGroupRelation } from './dto/update-manifest-group-Relation';
import { UpdateManifestDto } from '../../BaseEntities/manifest/dto/update-manifest.dto';
import { ActionType } from '../../enum/actions';
import { UpdateManifestJsonDto } from './dto/UpdateManifestJsonDto';
import * as path from 'node:path';
import { manifestOrigin } from '../../enum/origins';

@Injectable()
export class LinkManifestGroupService {
  private readonly logger = new CustomLogger();

  constructor(
    @InjectRepository(LinkManifestGroup)
    private readonly linkManifestGroupRepository: Repository<LinkManifestGroup>,
    private readonly manifestService: ManifestService,
    private readonly groupService: UserGroupService,
  ) {}

  async createManifest(createManifestDto) {
    try {
      const userGroup = await this.groupService.findUserPersonalGroup(
        createManifestDto.idCreator,
      );
      const manifestCreation = await this.manifestService.create({
        origin: createManifestDto.origin,
        description: createManifestDto.description,
        title: createManifestDto.title,
        idCreator: createManifestDto.idCreator,
        url: createManifestDto.url ? createManifestDto.url : null,
        path: createManifestDto.path ? createManifestDto.path : null,
        hash: createManifestDto.hash ? createManifestDto.hash : null,
        metadata: {},
      });
      return this.create({
        ...createManifestDto,
        manifest: manifestCreation,
        user_group: userGroup,
      });
    } catch (error) {
      this.logger.error(error.message, error.stack);
      throw new InternalServerErrorException(
        `an error occurred while creating linkGroupManifest, ${error.message}`,
      );
    }
  }

  async create(createLinkGroupManifestDto) {
    try {
      const linkGroupManifest: LinkManifestGroup =
        this.linkManifestGroupRepository.create({
          manifest: createLinkGroupManifestDto.manifest,
          user_group: createLinkGroupManifestDto.user_group,
          rights: createLinkGroupManifestDto.rights,
        });
      return await this.linkManifestGroupRepository.upsert(linkGroupManifest, {
        conflictPaths: ['rights', 'manifest', 'user_group'],
      });
    } catch (error) {
      this.logger.error(error.message, error.stack);
      throw new InternalServerErrorException(
        `an error occurred while creating linkGroupManifest, ${error.message}`,
      );
    }
  }

  async addManifestToGroup(addManifestToGroupDto: AddManifestToGroupDto) {
    const { userGroupId, manifestId } = addManifestToGroupDto;
    try {
      const manifestsForGroup = [];
      const manifest = await this.manifestService.findOne(manifestId);
      const group = await this.groupService.findOne(userGroupId);
      if (!manifest) {
        throw new InternalServerErrorException(
          `Project with id ${manifestId} not found`,
        );
      }
      await this.create({
        rights: addManifestToGroupDto.rights
          ? addManifestToGroupDto.rights
          : ManifestGroupRights.READER,
        user_group: group,
        manifest: manifest,
      });
      const groupForManifest = await this.getAllManifestsGroup(manifestId);
      manifestsForGroup.push(groupForManifest);
      return manifestsForGroup;
    } catch (error) {
      this.logger.error(error.message, error.stack);
      throw new InternalServerErrorException(
        `An Error occurred while adding manifests to userGroup with id ${userGroupId} : ${error.message}`,
      );
    }
  }

  async getAllManifestsGroup(manifestId: number) {
    try {
      return await this.findAllUserGroupByManifestId(manifestId);
    } catch (error) {
      this.logger.error(error.message, error.stack);
      throw new InternalServerErrorException(
        'an error occurred while getting all manifests group',
        error.message,
      );
    }
  }

  async getManifestForUser(userGroupId: number, manifestId: number) {
    try {
      const manifest =
        await this.findAllManifestGroupByUserGroupId(userGroupId);
      const toReturn = manifest.find(
        (linkGroupManifest) => linkGroupManifest.manifest.id == manifestId,
      );
      return toReturn.manifest;
    } catch (error) {
      this.logger.error(error.message, error.stack);
      return new InternalServerErrorException(
        'An error occurred while getting manifest for user group',
        error.message,
      );
    }
  }

  async updateManifest(updateManifestDto: UpdateManifestDto) {
    try {
      return await this.manifestService.update(
        updateManifestDto.id,
        updateManifestDto,
      );
    } catch (error) {
      this.logger.error(error.message, error.stack);
      throw new InternalServerErrorException(
        `an error occurred while updating manifest with id ${updateManifestDto.id}`,
        error.message,
      );
    }
  }

  private readJsonFile(filePath: string): any {
    try {
      const absolutePath = path.resolve(filePath);
      const fileContent = fs.readFileSync(absolutePath, 'utf-8');
      return JSON.parse(fileContent);
    } catch (error) {
      throw new Error(`Error reading file at ${filePath}: ${error.message}`);
    }
  }

  private writeJsonFile(filePath: string, data: any): void {
    try {
      const absolutePath = path.resolve(filePath);
      fs.writeFileSync(absolutePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
      throw new Error(`Error writing file at ${filePath}: ${error.message}`);
    }
  }

  async updateManifestJson(updateManifestJsonDto: UpdateManifestJsonDto) {
    try {
      if (updateManifestJsonDto.origin === manifestOrigin.LINK) {
        throw new UnsupportedMediaTypeException(
          "Manifests linked can't be updated",
        );
      }

      console.log('--------------updateManifestJsonDto.json--------------');
      console.log(updateManifestJsonDto.json);

      // Build the path to the file
      const path = `./upload/${updateManifestJsonDto.hash}/${updateManifestJsonDto.path}`;

      // Overwrite the file with the new JSON data
      this.writeJsonFile(path, updateManifestJsonDto.json);

      return { message: 'JSON file replaced successfully' };
    } catch (error) {
      this.logger.error(error.message, error.stack);
      throw new InternalServerErrorException(
        `An error occurred while updating manifest with ID ${updateManifestJsonDto.id}`,
        error.message,
      );
    }
  }


  async removeManifest(manifestId: number) {
    try {
      const manifestToRemove = await this.manifestService.findOne(manifestId);
      if (!manifestToRemove) {
        throw new HttpException('Manifest not found', HttpStatus.NOT_FOUND);
      }
      const filePath = join(
        __dirname,
        '..',
        '..',
        '..',
        '..',
        'upload',
        manifestToRemove.hash,
        manifestToRemove.path,
      );
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        const dirPath = join(
          __dirname,
          '..',
          '..',
          '..',
          '..',
          'upload',
          manifestToRemove.hash,
        );
        if (fs.existsSync(dirPath) && fs.readdirSync(dirPath).length === 0) {
          fs.rmdirSync(dirPath);
        }
        await this.manifestService.remove(manifestId);
        return {
          status: HttpStatus.OK,
          message: 'File and associated records deleted successfully',
        };
      }
    } catch (error) {
      this.logger.error(error.message, error.stack);
      throw new InternalServerErrorException(
        `an error occurred while removing manifest with id ${manifestId}`,
        error.message,
      );
    }
  }
  async updateAccessToManifest(
    updateManifestGroupRelation: UpdateManifestGroupRelation,
  ) {
    try {
      const { manifestId, userGroupId, rights } = updateManifestGroupRelation;
      const manifestToUpdate = await this.manifestService.findOne(manifestId);
      const groupToUpdate = await this.groupService.findOne(userGroupId);
      return this.updateManifestGroupRelation(
        manifestToUpdate,
        groupToUpdate,
        rights,
      );
    } catch (error) {
      this.logger.error(error.message, error.stack);
      throw new InternalServerErrorException(
        `an error occurred while updating access to manifest with id ${updateManifestGroupRelation.manifestId}, for the group with id ${updateManifestGroupRelation.userGroupId}`,
        error.message,
      );
    }
  }

  async removeAccesToManifest(manifestId: number, userGroupId: number) {
    try {
      console.log('manifestId', manifestId, 'group', userGroupId);
      const userGroupManifests =
        await this.findAllManifestByUserGroupId(userGroupId);
      const manifestToRemove = userGroupManifests.find(
        (userGroupManifest) => userGroupManifest.id == manifestId,
      );
      if (!manifestToRemove) {
        throw new NotFoundException(
          `No association between Manifest with ID ${manifestId} and group with ID ${userGroupId}`,
        );
      }
      return await this.removeManifestGroupRelation(
        manifestToRemove.id,
        userGroupId,
      );
    } catch (error) {
      this.logger.error(error.message, error.stack);
      throw new InternalServerErrorException(
        `an error occurred while removing link between manifest and group : ${error.message}`,
      );
    }
  }

  async findAll() {
    try {
      return await this.linkManifestGroupRepository.find();
    } catch (error) {
      this.logger.error(error.message, error.stack);
      throw new InternalServerErrorException(
        'An error occurred while finding linkMediaGroups',
        error,
      );
    }
  }

  async findAllUserGroupByManifestId(manifestId: number) {
    try {
      const request = await this.linkManifestGroupRepository.find({
        where: { manifest: { id: manifestId } },
        relations: ['user_group', 'manifest'],
      });
      return request.map((linkGroup: LinkManifestGroup) => linkGroup);
    } catch (error) {
      this.logger.error(error.message, error.stack);
      throw new InternalServerErrorException(
        `an error occurred while finding all User Group for Manifest with id ${manifestId}, ${error.message}`,
      );
    }
  }

  async findAllManifestGroupByUserGroupId(userGroupId: number) {
    try {
      const request = await this.linkManifestGroupRepository.find({
        where: { user_group: { id: userGroupId } },
        relations: ['manifest'],
      });
      return request;
    } catch (error) {
      this.logger.error(error.message, error.stack);
      throw new InternalServerErrorException(
        `an error occurred while finding all ManifestGroupByUserGroupId with userGroupId : ${userGroupId}`,
        error.message,
      );
    }
  }

  async findAllManifestByUserGroupId(id: number) {
    try {
      const request = await this.linkManifestGroupRepository.find({
        where: { user_group: { id: id } },
        relations: ['user_group'],
      });
      return request.map((linkGroup: LinkManifestGroup) => ({
        ...linkGroup.manifest,
        rights: linkGroup.rights,
      }));
    } catch (error) {
      this.logger.error(error.message, error.stack);
      throw new InternalServerErrorException(
        `an error occurred while finding manifest for userGroup with id ${id}`,
        error.message,
      );
    }
  }

  async updateManifestGroupRelation(
    manifest: Manifest,
    group: UserGroup,
    rights: ManifestGroupRights,
  ) {
    try {
      const linkManifestGroupsToUpdate =
        await this.linkManifestGroupRepository.find({
          where: {
            manifest: { id: manifest.id },
            user_group: { id: group.id },
          },
        });
      let linkManifestGroup;
      if (linkManifestGroupsToUpdate.length > 0) {
        linkManifestGroup = this.linkManifestGroupRepository.create({
          ...linkManifestGroupsToUpdate[0],
          rights: rights,
        });
      } else {
        linkManifestGroup = this.linkManifestGroupRepository.create({
          manifest: manifest,
          user_group: group,
          rights: rights,
        });
      }
      return await this.linkManifestGroupRepository.upsert(linkManifestGroup, {
        conflictPaths: ['rights', 'manifest', 'user_group'],
      });
    } catch (error) {
      this.logger.error(error.message, error.stack);
      throw new InternalServerErrorException(
        'An error occurred while updating the linkManifestGroup',
        error.message,
      );
    }
  }

  async removeManifestGroupRelation(manifestId: number, groupId: number) {
    try {
      const done = await this.linkManifestGroupRepository.delete({
        manifest: { id: manifestId },
        user_group: { id: groupId },
      });
      if (done.affected != 1) throw new NotFoundException(manifestId);
      return done;
    } catch (error) {
      this.logger.error(error.message, error.stack);
      throw new InternalServerErrorException(
        'An error occurred while removing the linkManifestGroup',
        error.message,
      );
    }
  }

  async getHighestRightForManifest(groupId: number, manifestId: number) {
    const linkEntities = await this.linkManifestGroupRepository.find({
      where: {
        user_group: { id: groupId },
        manifest: { id: manifestId },
      },
      relations: ['manifest', 'user_group'],
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
    manifestId: number,
    callback: (linkEntity: LinkManifestGroup) => any,
  ) {
    try {
      const userPersonalGroup =
        await this.groupService.findUserPersonalGroup(userId);

      const linkEntity = await this.getHighestRightForManifest(
        userPersonalGroup.id,
        manifestId,
      );

      if (!linkEntity) {
        return new ForbiddenException(
          'User does not have access to this manifest or the manifest does not exist',
        );
      }
      switch (action) {
        case ActionType.READ:
          if (
            [
              ManifestGroupRights.READER,
              ManifestGroupRights.ADMIN,
              ManifestGroupRights.EDITOR,
            ].includes(linkEntity.rights)
          ) {
            return callback(linkEntity);
          }
          break;
        case ActionType.UPDATE:
          if (
            [ManifestGroupRights.ADMIN, ManifestGroupRights.EDITOR].includes(
              linkEntity.rights,
            )
          ) {
            return callback(linkEntity);
          }
          break;
        case ActionType.DELETE:
          if (linkEntity.rights === ManifestGroupRights.ADMIN) {
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
}
