import { Box, CSSObject, Divider, Grid, IconButton, List, styled, Theme, Tooltip } from "@mui/material";
import { useCallback, useEffect, useRef, useState } from "react";
import Mirador from "mirador";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import MuiDrawer from "@mui/material/Drawer";
import WorkIcon from "@mui/icons-material/Work";
import SubscriptionsIcon from "@mui/icons-material/Subscriptions";
import GroupsIcon from "@mui/icons-material/Groups";
import ShareIcon from "@mui/icons-material/Share";
import ConnectWithoutContactIcon from "@mui/icons-material/ConnectWithoutContact";
import SettingsIcon from "@mui/icons-material/Settings";
import LogoutIcon from "@mui/icons-material/Logout";
import { ItemButton } from "./SideBar/ItemButton.tsx";
import { AllProjects } from "../../features/projects/components/AllProjects.tsx";
import { AllGroups } from "../../features/user-group/components/AllGroups.tsx";
import SaveIcon from "@mui/icons-material/Save";
import { updateProject } from "../../features/projects/api/updateProject.ts";
import toast from "react-hot-toast";
import { CreateProjectDto, ProjectUser } from "../../features/projects/types/types.ts";
import { createProject } from "../../features/projects/api/createProject.ts";
import IState from "../../features/mirador/interface/IState.ts";
import LocalStorageAdapter from "mirador-annotation-editor/src/annotationAdapter/LocalStorageAdapter.js";
import miradorAnnotationEditorVideo
  from "mirador-annotation-editor-video/src/plugin/MiradorAnnotationEditionVideoPlugin";
import { ProjectRights } from "../../features/user-group/types/types.ts";

const drawerWidth = 240;
const openedMixin = (theme: Theme): CSSObject => ({
  width: drawerWidth,
  transition: theme.transitions.create('width', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.enteringScreen,
  }),
  overflowX: 'hidden',
});

const closedMixin = (theme: Theme): CSSObject => ({
  transition: theme.transitions.create('width', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  overflowX: 'hidden',
  width: `calc(${theme.spacing(7)} + 1px)`,
  [theme.breakpoints.up('sm')]: {
    width: `calc(${theme.spacing(8)} + 1px)`,
  },
});

const DrawerHeader = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  padding: theme.spacing(0, 1),
  // necessary for content to be below app bar
  ...theme.mixins.toolbar,
}));

const Drawer = styled(MuiDrawer, { shouldForwardProp: (prop) => prop !== 'open' })(
  ({ theme, open }) => ({
    width: drawerWidth,
    flexShrink: 0,
    whiteSpace: 'nowrap',
    boxSizing: 'border-box',
    ...(open && {
      ...openedMixin(theme),
      '& .MuiDrawer-paper': openedMixin(theme),
    }),
    ...(!open && {
      ...closedMixin(theme),
      '& .MuiDrawer-paper': closedMixin(theme),
    }),
  }),
);
interface ISideDrawerProps{
  user: any,
  handleDisconnect:()=>void
  selectedProjectUser?:ProjectUser
  setSelectedProjectUser :(ProjectUser?:ProjectUser)=>void
}



const CONTENT = {
  PROJECTS:'PROJECT',
  GROUPS:'GROUPS'
}
export const SideDrawer = ({user,handleDisconnect,selectedProjectUser,setSelectedProjectUser}:ISideDrawerProps) => {
  const [open, setOpen] = useState(false);
  const viewerRef = useRef<HTMLDivElement | null>(null);
  const [selectedContent, setSelectedContent] = useState(CONTENT.PROJECTS)
  const [userProjects, setUserProjects] = useState<ProjectUser[]>([]);
  const [viewer, setViewer] = useState<IState>();
  const [miradorState] = useState<IState>();

  const handleDrawerOpen = () => {
    setOpen(true);
  };

  const handleSaveProject = useCallback((newProject:ProjectUser)=>{
    setUserProjects([...userProjects, newProject]);

  },[setUserProjects])
  const handleDrawerClose = () => {
    setOpen(false);
  };

  const handleChangeContent = (content:string)=>{
    setSelectedProjectUser(undefined);
    setSelectedContent(content);
  }

  const HandleSetUserProjects=(userProjects:ProjectUser[])=>{
    setUserProjects(userProjects)
  }

  const saveMiradorState = useCallback(async (state: IState) => {
    if (selectedProjectUser) {
      const projectToUpdate:ProjectUser = userProjects.find(projectUser => projectUser.project.id == selectedProjectUser.project.id)!;
      projectToUpdate.project.userWorkspace = state;
      if(projectToUpdate){
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { rights, ...projectWithoutRights } = projectToUpdate;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const projectUpdated =await updateProject(projectWithoutRights!)
        toast.success("Project saved");
      }

      toast.success("Project saved");
    } else {
      const project: CreateProjectDto = {
        name: 'new project',
        owner: user,
        userWorkspace: state,
      };
      createProject(project).then(r => {
        if(r){
          selectedProjectUser(r);
          handleSaveProject({
            ...r,
            project: { ...project, id: r.project.id }
          });
        }
      });
    }
  },[handleSaveProject, selectedProjectUser, user.id, userProjects])

  useEffect(() => {
    if (viewerRef.current) {
      const config = {
        id: viewerRef.current.id,
        annotation: {
          adapter: (canvasId : string) => new LocalStorageAdapter(`localStorage://?canvasId=${canvasId}`),
          // adapter: (canvasId) => new AnnototAdapter(canvasId, endpointUrl),
          exportLocalStorageAnnotations: false, // display annotation JSON export button
        }
      };


      let loadingMiradorViewer;
      // First displaying of the viewer
      if(!viewer){
        loadingMiradorViewer = Mirador.viewer(config, [
          ...miradorAnnotationEditorVideo]);
      }
      if(!miradorState){
        saveMiradorState(loadingMiradorViewer.store.getState(),);
      }


      // Load state only if it is not empty
      if (loadingMiradorViewer && miradorState) {
        loadingMiradorViewer.store.dispatch(
          Mirador.actions.importMiradorState(miradorState)
        );
      }

      setViewer(loadingMiradorViewer);
    }
  }, []);

  const saveProject = () => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    saveMiradorState(viewer!.store.getState());
  }



  return(
    <>
      <Drawer variant="permanent" open={open}
      >
        <DrawerHeader>
          <IconButton onClick={open ?  handleDrawerClose : handleDrawerOpen }>
            {!open ? <ChevronRightIcon /> : <ChevronLeftIcon />}
          </IconButton>
        </DrawerHeader>
        <Divider />
        <List sx={{minHeight:'70vh'}}>
          <Tooltip title={"Mes projects"}><ItemButton selected={CONTENT.PROJECTS=== selectedContent} open={open} icon={<WorkIcon />} text="Projects" action={()=>handleChangeContent(CONTENT.PROJECTS)}/></Tooltip>
          <Tooltip title=""><ItemButton open={open} selected={false} icon={<SubscriptionsIcon />} text="Media" action={()=>{console.log('Media')}}/></Tooltip>
          <Tooltip title=""><ItemButton open={open} selected={CONTENT.GROUPS === selectedContent} icon={<GroupsIcon />} text="Groups" action={()=>handleChangeContent(CONTENT.GROUPS)}/></Tooltip>
          <Tooltip title=""><ItemButton open={open} selected={false} icon={<ShareIcon />} text="Shares" action={()=>{console.log('Shares')}}/></Tooltip>
          <Tooltip title=""><ItemButton open={open} selected={false} icon={<ConnectWithoutContactIcon />} text="API" action={()=>{console.log('API')}}/></Tooltip>
        </List>
        <Divider/>
        <List>
          {selectedProjectUser && selectedProjectUser.rights !== ProjectRights.READER && (
            <Tooltip title=""><ItemButton open={open} selected={false} icon={<SaveIcon />} text="Save Mirador" action={saveProject}/></Tooltip>
          )
          }
        </List>
        <Divider />
        <List>
          <ItemButton open={open} selected={false} icon={<SettingsIcon />} text="Settings" action={()=>{console.log('settings')}}/>
          <ItemButton open={open} selected={false} icon={<LogoutIcon />} text="Disconnect" action={handleDisconnect}/>
        </List>
      </Drawer>
      <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
        <Grid item container direction="column">
          <Grid item>
            {user && user.id && selectedContent === CONTENT.PROJECTS && (
              <AllProjects
                selectedProjectUser={selectedProjectUser}
                setSelectedProjectUser={setSelectedProjectUser}
                user={user}
                userProjects={userProjects}
                setUserProjects={HandleSetUserProjects}
                viewer={viewer}
                setViewer={setViewer}
              />

            )}
            {
              user && user.id && selectedContent === CONTENT.GROUPS &&(
                <AllGroups
                  user={user}
                />
              )
            }
          </Grid>
        </Grid>
      </Box>
    </>
  )
}
